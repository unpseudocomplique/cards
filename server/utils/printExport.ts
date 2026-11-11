import JSZip from 'jszip'
import { and, eq, isNotNull } from 'drizzle-orm'
import { upscaleToPrintCanvas } from '~~/server/utils/cardRenderer'
import { db, deckCards, type DeckStyleSettings } from '~~/server/utils/db'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'
import { getCardTheme } from '~~/shared/utils/cardThemes'
import {
  DECK_CARD_ASPECT_RATIO,
  PRINT_SPEC_SUMMARY,
  getPrintCanvasPx
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
  const cards = await db
    .select({
      cardCode: deckCards.cardCode,
      metadata: deckCards.metadata,
      finalImageUrl: deckCards.finalImageUrl
    })
    .from(deckCards)
    .where(and(
      eq(deckCards.deckId, options.deckId),
      eq(deckCards.userId, options.userId),
      isNotNull(deckCards.finalImageUrl)
    ))

  if (!cards.length) {
    throw new Error('Aucune carte prête à exporter')
  }

  const zip = new JSZip()
  const faces = zip.folder('print/faces')
  const back = zip.folder('print/back')

  if (!faces || !back) {
    throw new Error('Impossible de préparer le ZIP')
  }

  const theme = getCardTheme(options.settings.colorTheme)
  const canvas = getPrintCanvasPx(DECK_CARD_ASPECT_RATIO)

  for (const card of cards) {
    const code = sanitizeCode(card.cardCode)
    const faceBuffer = await readRemoteBuffer(card.finalImageUrl!)
    faces.file(`${code}.png`, await upscaleToPrintCanvas(faceBuffer, theme.id))
  }

  // One back for the whole deck: every card is printed with this same file.
  if (options.settings.cardBackImageUrl) {
    const backBuffer = await readRemoteBuffer(options.settings.cardBackImageUrl)
    back.file('card-back.png', await upscaleToPrintCanvas(backBuffer, theme.id))
  }

  const spec = {
    ...PRINT_SPEC_SUMMARY,
    deck: {
      id: options.deckId,
      title: options.deckTitle,
      type: options.deckType,
      colorTheme: theme.id,
      cardCount: cards.length,
      hasCardBack: Boolean(options.settings.cardBackImageUrl)
    },
    canvas,
    instructions: [
      'Toutes les cartes ont le même format et le même dos (print/back/card-back.png).',
      'Bleed: 3 mm inclus sur chaque côté. Ne pas recadrer avant validation BAT.'
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
    hasCardBack: Boolean(options.settings.cardBackImageUrl)
  }
}
