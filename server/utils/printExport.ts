import JSZip from 'jszip'
import { and, eq, isNotNull } from 'drizzle-orm'
import {
  renderCardBackFoilMaskFromArt,
  renderSurgicalCardFoilMask,
  upscaleToPrintCanvas
} from '~~/server/utils/cardRenderer'
import { db, deckCards, type DeckStyleSettings } from '~~/server/utils/db'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'
import {
  PRINT_SPEC_SUMMARY,
  getPrintCanvasPx,
  getTrimMm,
  type PrintAspectRatio
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
  defaultAspectRatio: PrintAspectRatio
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
  const foil = zip.folder('print/foil')
  const back = zip.folder('print/back')

  if (!faces || !foil || !back) {
    throw new Error('Impossible de préparer le ZIP')
  }

  const pokerCanvas = getPrintCanvasPx('3:4')
  const tarotCanvas = getPrintCanvasPx('9:16')

  for (const card of cards) {
    const aspectRatio = (card.metadata.aspectRatio || '3:4') as PrintAspectRatio
    const code = sanitizeCode(card.cardCode)
    const faceBuffer = await readRemoteBuffer(card.finalImageUrl!)
    const printFace = await upscaleToPrintCanvas(faceBuffer, aspectRatio)
    const foilMask = await renderSurgicalCardFoilMask({
      card: {
        label: card.metadata.label,
        shortLabel: card.metadata.shortLabel,
        rank: card.metadata.rank,
        role: card.metadata.role,
        suit: card.metadata.suit,
        aspectRatio
      },
      faceImage: printFace,
      profile: 'print',
      // Chrome frames + painted gold on costume/jewelry.
      includeChrome: true
    })

    faces.file(`${code}.png`, printFace)
    foil.file(`${code}-foil.png`, foilMask)
  }

  if (options.settings.cardBackImageUrl) {
    const backBuffer = await readRemoteBuffer(options.settings.cardBackImageUrl)
    const printBack = await upscaleToPrintCanvas(backBuffer, options.defaultAspectRatio)
    back.file('card-back.png', printBack)
    // Surgical foil from gold painted in the back artwork (not geometric rectangles).
    const sizedBackFoil = await renderCardBackFoilMaskFromArt(printBack)
    back.file('card-back-foil.png', sizedBackFoil)
  }

  const spec = {
    ...PRINT_SPEC_SUMMARY,
    deck: {
      id: options.deckId,
      title: options.deckTitle,
      type: options.deckType,
      cardCount: cards.length,
      hasCardBack: Boolean(options.settings.cardBackImageUrl)
    },
    canvases: {
      '3:4': {
        trimMm: getTrimMm('3:4'),
        ...pokerCanvas
      },
      '9:16': {
        trimMm: getTrimMm('9:16'),
        ...tarotCanvas
      }
    },
    instructions: [
      'Foil faces: noir = dorure (or peint du costume + cadres chrome). Blanc = sans dorure.',
      'Foil dos (card-back-foil.png): extraction chirurgicale de l’or peint dans le motif du dos.',
      'Bleed: 3 mm inclus sur chaque côté. Ne pas recadrer avant validation BAT.',
      'Tout le pipeline dorure est produit dans l’application — aucun masque Illustrator requis.'
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
