import JSZip from 'jszip'
import { and, eq, isNotNull } from 'drizzle-orm'
import { upscaleToPrintCanvas } from '~~/server/utils/cardRenderer'
import { db, deckCards, type DeckStyleSettings } from '~~/server/utils/db'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'
import { getCardTheme } from '~~/shared/utils/cardThemes'
import {
  PRINT_BLEED_MM,
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

function sanitizeCode(cardCode: string) {
  return cardCode.replace(/[^a-zA-Z0-9_-]+/g, '-')
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

  const zip = new JSZip()
  const faces = zip.folder('print/faces')
  const back = zip.folder('print/back')

  if (!faces || !back) {
    throw new Error('Impossible de préparer le ZIP')
  }

  const theme = getCardTheme(options.settings.colorTheme)
  const canvas = getPrintCanvasPx(format)

  for (const card of cards) {
    const code = sanitizeCode(card.cardCode)
    const faceBuffer = await readRemoteBuffer(card.finalImageUrl!)
    faces.file(`${code}.png`, await upscaleToPrintCanvas(faceBuffer, theme.id, format.id))
  }

  // One back for the whole deck: every card is printed with this same file.
  if (backUrl) {
    const backBuffer = await readRemoteBuffer(backUrl)
    back.file('card-back.png', await upscaleToPrintCanvas(backBuffer, theme.id, format.id))
  }

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
      'Toutes les cartes ont le même format et le même dos (print/back/card-back.png).',
      `Fond perdu : ${PRINT_BLEED_MM} mm inclus de chaque côté, à couper au format ${formatTrimLabel(format)}. Ne pas recadrer avant validation du BAT.`,
      format.layout === 'band'
        ? `Zone de sécurité : contour, index et cadre sont à ${PRINT_SAFE_MM} mm ou plus de la ligne de coupe.`
        : 'Format poker : le contour est à environ 2 mm de la coupe, prévoir une coupe précise.'
    ]
  }

  zip.file('print/print-spec.json', JSON.stringify(spec, null, 2))

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  })

  const key = generateFileKey(`users/${options.userId}/decks/${options.deckId}/exports`, 'print-pack.zip')
  const url = await uploadFile(zipBuffer, key, 'application/zip')

  return {
    key,
    url,
    cardCount: cards.length,
    hasCardBack: Boolean(backUrl)
  }
}
