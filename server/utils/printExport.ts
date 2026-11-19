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
          .select({
            id: deckVariants.id,
            name: deckVariants.name,
            backImageUrl: deckVariants.backImageUrl,
            backFormat: deckVariants.backFormat
          })
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
  const deckBackUrl = options.settings.cardBackImageUrl
    && resolveDeckCardFormat({ cardFormat: options.settings.cardBackFormat }).id === format.id
    ? options.settings.cardBackImageUrl
    : null

  // Each printed version is the complete deck: the deck's faces, with the
  // variant's own faces in place of the cards it overrides.
  const versions = [
    ...(selection.includeBase
      ? [{
          id: 'base',
          name: options.deckTitle,
          isBase: true,
          fileSlug: slug,
          overrides: [] as typeof overrides,
          ownBack: null as { url: string, format: string | null } | null
        }]
      : []),
    ...variants.map((variant, index) => ({
      id: variant.id,
      name: variant.name,
      isBase: false,
      fileSlug: `${slug}-${variantSlugs[index]}`,
      overrides: overrides.filter(override => override.variantId === variant.id),
      ownBack: variant.backImageUrl ? { url: variant.backImageUrl, format: variant.backFormat } : null
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
    // Like an overridden card, a variant back is never replaced by the deck back.
    if (version.ownBack && (version.ownBack.format || 'poker') !== format.id) {
      return [`« ${version.name} » : dos de la variante à régénérer au format ${formatTrimLabel(format)}`]
    }
    return []
  })

  if (problems.length) {
    throw new Error(problems.join(' · '))
  }

  const theme = getCardTheme(options.settings.colorTheme)
  const canvas = getPrintCanvasPx(format)

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

  // Back pages are converted once, even when several decks share the deck back.
  const backJpegCache = new Map<string, Promise<Buffer>>()

  function backJpeg(url: string) {
    let jpeg = backJpegCache.get(url)
    if (!jpeg) {
      jpeg = (async () => toPrintCmykJpeg(await upscaleToPrintCanvas(await readRemoteBuffer(url), theme.id, format.id)))()
      backJpegCache.set(url, jpeg)
    }
    return jpeg
  }

  const zip = new JSZip()
  const printed = []
  // Several decks: one folder per deck, each with its recto and its verso.
  const inFolders = versions.length > 1

  for (const version of versions) {
    const folder = inFolders ? `${version.fileSlug}/` : ''
    const rectoName = `${folder}${version.fileSlug}-recto.pdf`
    const title = version.isBase ? options.deckTitle : `${options.deckTitle} - ${version.name}`
    const pages = []

    // Recto: every face of the deck in order, one card per page.
    for (const [index, face] of version.faces.entries()) {
      pages.push({
        cmykJpeg: await printJpeg(face),
        label: `${title} - recto ${index + 1}/${version.faces.length} - ${face.card.cardCode}`
      })
    }

    zip.file(rectoName, await buildPrintPdf({ title: `${title} - recto`, format, pages }))

    // Verso: the variant's own back, or the deck back.
    const backUrl = version.ownBack?.url ?? deckBackUrl
    const versoName = backUrl ? `${folder}${version.fileSlug}-verso.pdf` : null

    if (backUrl && versoName) {
      zip.file(versoName, await buildPrintPdf({
        title: `${title} - verso`,
        format,
        pages: [{
          cmykJpeg: await backJpeg(backUrl),
          label: `${title} - verso (dos commun aux ${version.faces.length} cartes)`
        }]
      }))
    }

    printed.push({
      id: version.id,
      name: version.name,
      file: rectoName,
      versoFile: versoName,
      ownBack: Boolean(version.ownBack),
      cardCount: version.faces.length,
      overriddenCount: version.faces.filter(face => face.overridden).length
    })
  }

  const totalCards = printed.reduce((sum, version) => sum + version.cardCount, 0)
  const hasCardBack = printed.some(version => version.versoFile)

  const instruction = printed.length === 1
    ? `${printed[0]!.file} : les ${printed[0]!.cardCount} faces, une carte par page.${printed[0]!.versoFile ? ` ${printed[0]!.versoFile} : le dos, identique pour toutes les cartes.` : ''}`
    : `${printed.length} jeux complets, un dossier par jeu avec son PDF recto (une carte par page) et son PDF verso (le dos de toutes ses cartes) : ${printed.map(version => `${version.name} (${version.cardCount} cartes${version.ownBack ? ', dos propre' : ''})`).join(', ')}.`

  const spec = {
    ...getPrintSpecSummary(format),
    deck: {
      id: options.deckId,
      title: options.deckTitle,
      type: options.deckType,
      colorTheme: theme.id,
      cardCount: printed[0]!.cardCount,
      hasCardBack
    },
    versions: printed,
    canvas,
    instructions: [
      instruction,
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
    hasCardBack
  }
}
