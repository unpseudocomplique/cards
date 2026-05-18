import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { generateImage } from 'ai'
import { and, count, eq } from 'drizzle-orm'
import { aiImageModel } from '~~/server/utils/ai'
import { buildCardImagePrompt } from '~~/server/utils/cardPromptBuilder'
import { renderCardImage } from '~~/server/utils/cardRenderer'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckCards, deckPhotos, decks } from '~~/server/utils/db'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'

function mediaTypeToExtension(mediaType?: string) {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  }

  return extensions[mediaType || ''] || 'png'
}

async function readPhotoBuffer(url: string) {
  if (url.startsWith('/')) {
    return readFile(join(process.cwd(), 'public', url.replace(/^\/+/, '')))
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Photo source inaccessible')
  }

  return Buffer.from(await response.arrayBuffer())
}

async function updateDeckProgress(deckId: string) {
  const [readyResult] = await db
    .select({ value: count() })
    .from(deckCards)
    .where(and(eq(deckCards.deckId, deckId), eq(deckCards.status, 'ready')))

  const [deck] = await db
    .select({ cardCount: decks.cardCount })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1)

  const readyCardCount = readyResult?.value || 0
  const status = deck && readyCardCount === deck.cardCount ? 'ready' : 'draft'

  await db
    .update(decks)
    .set({ readyCardCount, status, updatedAt: new Date() })
    .where(eq(decks.id, deckId))
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')
  const cardId = getRouterParam(event, 'cardId')

  if (!deckId || !cardId) {
    throw createError({ status: 400, message: 'Carte manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const [row] = await db
    .select({ card: deckCards, photo: deckPhotos })
    .from(deckCards)
    .leftJoin(deckPhotos, eq(deckCards.sourcePhotoId, deckPhotos.id))
    .where(and(
      eq(deckCards.id, cardId),
      eq(deckCards.deckId, deck.id),
      eq(deckCards.userId, session.user.id)
    ))
    .limit(1)

  if (!row?.card) {
    throw createError({ status: 404, message: 'Carte introuvable' })
  }

  if (!row.photo) {
    throw createError({ status: 400, message: 'Affectez une photo à cette carte avant le test' })
  }

  await db.transaction(async (tx) => {
    await tx
      .update(decks)
      .set({ status: 'generating', updatedAt: new Date() })
      .where(eq(decks.id, deck.id))

    await tx
      .update(deckCards)
      .set({ status: 'generating', errorMessage: null, updatedAt: new Date() })
      .where(eq(deckCards.id, row.card.id))
  })

  try {
    const sourceBuffer = await readPhotoBuffer(row.photo.url)
    const prompt = buildCardImagePrompt(row.card.metadata, deck.settings, row.card.prompt)
    const { image } = await generateImage({
      model: aiImageModel,
      prompt: {
        text: prompt,
        images: [sourceBuffer]
      },
      aspectRatio: row.card.metadata.aspectRatio,
      n: 1
    })

    if (!image?.uint8Array) {
      throw new Error('Aucune image générée')
    }

    const rawBuffer = Buffer.from(image.uint8Array)
    const rawMediaType = image.mediaType || 'image/png'
    const rawExtension = mediaTypeToExtension(rawMediaType)
    const prefix = `users/${session.user.id}/decks/${deck.id}/cards/${row.card.id}`
    const rawImageKey = generateFileKey(prefix, `raw.${rawExtension}`)
    const rawImageUrl = await uploadFile(rawBuffer, rawImageKey, rawMediaType)
    const finalBuffer = await renderCardImage(rawBuffer, row.card.metadata)
    const finalImageKey = generateFileKey(prefix, 'final.png')
    const finalImageUrl = await uploadFile(finalBuffer, finalImageKey, 'image/png')

    const [card] = await db
      .update(deckCards)
      .set({
        status: 'ready',
        rawImageKey,
        rawImageUrl,
        finalImageKey,
        finalImageUrl,
        errorMessage: null,
        updatedAt: new Date()
      })
      .where(eq(deckCards.id, row.card.id))
      .returning()

    await updateDeckProgress(deck.id)

    return card
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Génération impossible'

    await db.transaction(async (tx) => {
      await tx
        .update(deckCards)
        .set({ status: 'failed', errorMessage: message, updatedAt: new Date() })
        .where(eq(deckCards.id, row.card.id))

      await tx
        .update(decks)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(decks.id, deck.id))
    })

    throw createError({ status: 500, message })
  }
})
