import JSZip from 'jszip'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { renderClassicCardImage, upscaleToPrintCanvas } from '~~/server/utils/cardRenderer'
import { db, deckCards, deckVariantCards, deckVariants, type DeckStyleSettings } from '~~/server/utils/db'
import { buildPrintPdf, toPrintCmykJpeg } from '~~/server/utils/printPdf'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'
import { getCardTheme } from '~~/shared/utils/cardThemes'
import { resolvePrintFaces, slugifyName, uniqueSlugs } from '~~/shared/utils/deckVariants'
import {
  PRINT_BLEED_MM,
  PRINT_CROP_MARK_LENGTH_MM,
  PRINT_ICC_PROFILE,
  PRINT_SAFE_MM,
  formatTrimLabel,
  getPrintCanvasPx,
  getPrintSpecSummary,
  resolveDeckCardFormat
} from '~~/shared/utils/printSpec'

async function readRemoteBuffer(url: string) {
  if (url.startsWith('/')) {
    const { readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    return readFile(join(process.cwd(), 'public', url.replace(/^\/+/, '')))
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Fichier inaccessible: ${url}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

function plural(count: number, word: string) {
  return `${count} ${word}${count > 1 ? 's' : ''}`
}

/** Which versions of the deck to print. Defaults to the deck alone. */
export type PrintSelection = {
  includeBase: boolean
  variantIds: string[]
}

export async function buildPrintExportZip(options: {
  deckId: string
  userId: string
  deckTitle: string
  deckType: string
  settings: DeckStyleSettings
  selection?: PrintSelection
}) {
  const selection = options.selection ?? { includeBase: true, variantIds: [] }
  const variantIds = [...new Set(selection.variantIds)]

  if (!selection.includeBase && !variantIds.length) {
    throw new Error('Choisissez au moins une version du jeu à imprimer')
  }

  const [baseCards, variants, overrides] = await Promise.all([
    db
      .select({
        id: deckCards.id,
        cardCode: deckCards.cardCode,
        status: deckCards.status,
        metadata: deckCards.metadata,
        finalImageUrl: deckCards.finalImageUrl
      })
      .from(deckCards)
      .where(and(eq(deckCards.deckId, options.deckId), eq(deckCards.userId, options.userId)))
      .orderBy(asc(deckCards.sortOrder)),
    variantIds.length
      ? db
          .select({ id: deckVariants.id, name: deckVariants.name })
          .from(deckVariants)
          .where(and(
            eq(deckVariants.deckId, options.deckId),
            eq(deckVariants.userId, options.userId),
            inArray(deckVariants.id, variantIds)
          ))
          .orderBy(asc(deckVariants.createdAt))
      : Promise.resolve([]),
    variantIds.length
      ? db
          .select({
            variantId: deckVariantCards.variantId,
            baseCardId: deckVariantCards.baseCardId,
            status: deckVariantCards.status,
            metadata: deckVariantCards.metadata,
            finalImageUrl: deckVariantCards.finalImageUrl
          })
          .from(deckVariantCards)
          .where(and(eq(deckVariantCards.deckId, options.deckId), inArray(deckVariantCards.variantId, variantIds)))
      : Promise.resolve([])
  ])

  if (variants.length !== variantIds.length) {
    throw new Error('Variante introuvable')
  }

  const format = resolveDeckCardFormat(options.settings)
  const slug = slugifyName(options.deckTitle)
  const variantSlugs = uniqueSlugs(variants.map(variant => variant.name))

  // Each printed version is the complete deck: the deck's faces, with the
  // variant's own faces in place of the cards it overrides.
  const versions = [
    ...(selection.includeBase
      ? [{ id: 'base', name: options.deckTitle, isBase: true, fileSlug: slug, overrides: [] as typeof overrides }]
      : []),
    ...variants.map((variant, index) => ({
      id: variant.id,
      name: variant.name,
      isBase: false,
      fileSlug: `${slug}-${variantSlugs[index]}`,
      overrides: overrides.filter(override => override.variantId === variant.id)
    }))
  ].map(version => ({
    ...version,
    ...resolvePrintFaces(baseCards, version.overrides, format.id)
  }))

  const problems = versions.flatMap((version) => {
    if (version.missing.length) {
      const labels = version.missing.slice(0, 3).map(card => card.metadata.label).join(', ')
      return [`« ${version.name} » : ${plural(version.missing.length, 'carte modifiée')} pas encore ${version.missing.length > 1 ? 'générées' : 'générée'} au format ${formatTrimLabel(format)} (${labels}${version.missing.length > 3 ? '…' : ''})`]
    }
    if (!version.faces.length) {
      return [`« ${version.name} » : aucune carte prête au format ${formatTrimLabel(format)}`]
    }
    return []
  })

  if (problems.length) {
    throw new Error(problems.join(' · '))
  }

  const backUrl = options.settings.cardBackImageUrl
    && resolveDeckCardFormat({ cardFormat: options.settings.cardBackFormat }).id === format.id
    ? options.settings.cardBackImageUrl
    : null

  const theme = getCardTheme(options.settings.colorTheme)
  const canvas = getPrintCanvasPx(format)
  const versoName = `${slug}-verso.pdf`

  // Cards shared by several versions are rendered and converted to CMYK once.
  const jpegCache = new Map<string, Promise<Buffer>>()

  function printJpeg(face: (typeof versions)[number]['faces'][number]) {
    const key = face.classic ? `classic:${face.card.id}` : face.finalImageUrl
    let jpeg = jpegCache.get(key)

    if (!jpeg) {
      jpeg = (async () => {
        // Classic aces and numerals are pure vector: draw them straight at print size.
        const image = face.classic
          ? await renderClassicCardImage(face.card.metadata, { profile: 'print', theme: theme.id, format: format.id })
          : await upscaleToPrintCanvas(await readRemoteBuffer(face.finalImageUrl), theme.id, format.id)
        return toPrintCmykJpeg(image)
      })()
      jpegCache.set(key, jpeg)
    }

    return jpeg
  }

  const zip = new JSZip()
  const printed = []

  // Recto: every face of the version in the deck order, one card per page.
  for (const version of versions) {
    const rectoName = `${version.fileSlug}-recto.pdf`
    const title = version.isBase ? options.deckTitle : `${options.deckTitle} - ${version.name}`
    const pages = []

    for (const [index, face] of version.faces.entries()) {
      pages.push({
        cmykJpeg: await printJpeg(face),
        label: `${title} - recto ${index + 1}/${version.faces.length} - ${face.card.cardCode}`
      })
    }

    zip.file(rectoName, await buildPrintPdf({ title: `${title} - recto`, format, pages }))
    printed.push({
      id: version.id,
      name: version.name,
      file: rectoName,
      cardCount: version.faces.length,
      overriddenCount: version.faces.filter(face => face.overridden).length
    })
  }

  // Verso: one back for the whole deck and all its variants.
  const totalCards = printed.reduce((sum, version) => sum + version.cardCount, 0)

  if (backUrl) {
    zip.file(versoName, await buildPrintPdf({
      title: `${options.deckTitle} - verso`,
      format,
      pages: [{
        image: await upscaleToPrintCanvas(await readRemoteBuffer(backUrl), theme.id, format.id),
        label: `${options.deckTitle} - verso (dos commun aux ${totalCards} cartes)`
      }]
    }))
  }

  const rectoInstruction = printed.length === 1
    ? `${printed[0]!.file} : les ${printed[0]!.cardCount} faces, une carte par page.`
    : `${printed.length} jeux complets, un PDF recto par jeu (une carte par page) : ${printed.map(version => `${version.file} (${version.name}, ${version.cardCount} cartes)`).join(', ')}.`

  const spec = {
    ...getPrintSpecSummary(format),
    deck: {
      id: options.deckId,
      title: options.deckTitle,
      type: options.deckType,
      colorTheme: theme.id,
      cardCount: printed[0]!.cardCount,
      hasCardBack: Boolean(backUrl)
    },
    versions: printed,
    canvas,
    instructions: [
      `${rectoInstruction} ${backUrl ? `${versoName} : le dos, identique pour toutes les cartes${printed.length > 1 ? ' de tous les jeux' : ''}.` : ''}`.trim(),
      `Couleurs en CMJN, profil ${PRINT_ICC_PROFILE.description}.`,
      `Fond perdu : ${PRINT_BLEED_MM} mm inclus de chaque côté, à couper au format ${formatTrimLabel(format)} (TrimBox du PDF). Traits de coupe de ${PRINT_CROP_MARK_LENGTH_MM} mm, hors fond perdu.`,
      format.layout === 'band'
        ? `Zone de sécurité : contour, index et cadre sont à ${PRINT_SAFE_MM} mm ou plus de la ligne de coupe.`
        : 'Format poker : le contour est à environ 2 mm de la coupe, prévoir une coupe précise.'
    ]
  }

  zip.file('print-spec.json', JSON.stringify(spec, null, 2))

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    // PDFs hold JPEGs already: storing them is as small and much faster.
    compression: 'STORE'
  })

  const zipSlug = printed.length === 1 ? versions[0]!.fileSlug : slug
  const key = generateFileKey(`users/${options.userId}/decks/${options.deckId}/exports`, `${zipSlug}-impression.zip`)
  const url = await uploadFile(zipBuffer, key, 'application/zip')

  return {
    key,
    url,
    cardCount: totalCards,
    versions: printed,
    hasCardBack: Boolean(backUrl)
  }
}
