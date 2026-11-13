import JSZip from 'jszip'
import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { upscaleToPrintCanvas } from '~~/server/utils/cardRenderer'
import { db, deckCards, type DeckStyleSettings } from '~~/server/utils/db'
import { buildPrintPdf } from '~~/server/utils/printPdf'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'
import { getCardTheme } from '~~/shared/utils/cardThemes'
import {
  PRINT_BLEED_MM,
  PRINT_CROP_MARK_LENGTH_MM,
  PRINT_ICC_PROFILE,
  PRINT_SAFE_MM,
  formatTrimLabel,
  getPrintCanvasPx,
  getPrintSpecSummary,
  resolveCardImageFormat,
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

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'jeu'
}

export async function buildPrintExportZip(options: {
  deckId: string
  userId: string
  deckTitle: string
  deckType: string
  settings: DeckStyleSettings
}) {
  const rows = await db
    .select({
      cardCode: deckCards.cardCode,
      metadata: deckCards.metadata,
      finalImageUrl: deckCards.finalImageUrl
    })
    .from(deckCards)
    .where(and(
      eq(deckCards.deckId, options.deckId),
      eq(deckCards.userId, options.userId),
      eq(deckCards.status, 'ready'),
      isNotNull(deckCards.finalImageUrl)
    ))
    .orderBy(asc(deckCards.sortOrder))

  const format = resolveDeckCardFormat(options.settings)
  // A deck is printed in one format only: faces left over from a previous
  // format must be regenerated before they can be exported.
  const cards = rows.filter(card => resolveCardImageFormat(card.metadata).id === format.id)

  if (!cards.length) {
    throw new Error(`Aucune carte prête au format ${formatTrimLabel(format)} à exporter`)
  }

  const backUrl = options.settings.cardBackImageUrl
    && resolveDeckCardFormat({ cardFormat: options.settings.cardBackFormat }).id === format.id
    ? options.settings.cardBackImageUrl
    : null

  const theme = getCardTheme(options.settings.colorTheme)
  const canvas = getPrintCanvasPx(format)
  const slug = slugify(options.deckTitle)
  const rectoName = `${slug}-recto.pdf`
  const versoName = `${slug}-verso.pdf`

  // Recto: every face in the deck order, one card per page.
  const faces = []

  for (const [index, card] of cards.entries()) {
    const faceBuffer = await readRemoteBuffer(card.finalImageUrl!)
    faces.push({
      image: await upscaleToPrintCanvas(faceBuffer, theme.id, format.id),
      label: `${options.deckTitle} - recto ${index + 1}/${cards.length} - ${card.cardCode}`
    })
  }

  const recto = await buildPrintPdf({
    title: `${options.deckTitle} - recto`,
    format,
    pages: faces
  })

  // Verso: one back for the whole deck, printed behind every card.
  const verso = backUrl
    ? await buildPrintPdf({
        title: `${options.deckTitle} - verso`,
        format,
        pages: [{
          image: await upscaleToPrintCanvas(await readRemoteBuffer(backUrl), theme.id, format.id),
          label: `${options.deckTitle} - verso (dos commun aux ${cards.length} cartes)`
        }]
      })
    : null

  const spec = {
    ...getPrintSpecSummary(format),
    deck: {
      id: options.deckId,
      title: options.deckTitle,
      type: options.deckType,
      colorTheme: theme.id,
      cardCount: cards.length,
      hasCardBack: Boolean(backUrl)
    },
    canvas,
    instructions: [
      `${rectoName} : les ${cards.length} faces, une carte par page. ${versoName} : le dos, identique pour toutes les cartes.`,
      `Couleurs en CMJN, profil ${PRINT_ICC_PROFILE.description}.`,
      `Fond perdu : ${PRINT_BLEED_MM} mm inclus de chaque côté, à couper au format ${formatTrimLabel(format)} (TrimBox du PDF). Traits de coupe de ${PRINT_CROP_MARK_LENGTH_MM} mm, hors fond perdu.`,
      format.layout === 'band'
        ? `Zone de sécurité : contour, index et cadre sont à ${PRINT_SAFE_MM} mm ou plus de la ligne de coupe.`
        : 'Format poker : le contour est à environ 2 mm de la coupe, prévoir une coupe précise.'
    ]
  }

  const zip = new JSZip()
  zip.file(rectoName, recto)

  if (verso) {
    zip.file(versoName, verso)
  }

  zip.file('print-spec.json', JSON.stringify(spec, null, 2))

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    // PDFs hold JPEGs already: storing them is as small and much faster.
    compression: 'STORE'
  })

  const key = generateFileKey(`users/${options.userId}/decks/${options.deckId}/exports`, `${slug}-impression.zip`)
  const url = await uploadFile(zipBuffer, key, 'application/zip')

  return {
    key,
    url,
    cardCount: cards.length,
    hasCardBack: Boolean(backUrl)
  }
}
