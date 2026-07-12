import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { generateImage } from 'ai'
import { and, asc, count, eq } from 'drizzle-orm'
import { aiImageModel } from '~~/server/utils/ai'
import { buildCardForegroundPrompt, buildCardScenePrompt } from '~~/server/utils/cardPromptBuilder'
import { renderCardImage } from '~~/server/utils/cardRenderer'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { MAX_PERSON_REFERENCE_PHOTOS } from '~~/server/utils/deckPersons'
import { db, deckCards, deckPhotos, decks } from '~~/server/utils/db'
import { assertCanGenerate } from '~~/server/utils/generationAccess'
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
  const session = await requireUserSession(event) as { user: { email: string, id: string } }
  assertCanGenerate(session.user)
  const deckId = getRouterParam(event, 'id')
  const cardId = getRouterParam(event, 'cardId')

  if (!deckId || !cardId) {
    throw createError({ status: 400, message: 'Carte manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const [card] = await db
    .select()
    .from(deckCards)
    .where(and(
      eq(deckCards.id, cardId),
      eq(deckCards.deckId, deck.id),
      eq(deckCards.userId, session.user.id)
    ))
    .limit(1)

  if (!card) {
    throw createError({ status: 404, message: 'Carte introuvable' })
  }

  const personId = card.sourcePersonId

  if (!personId) {
    throw createError({ status: 400, message: 'Affectez une personne à cette carte avant le test' })
  }

  const referencePhotos = await db
    .select()
    .from(deckPhotos)
    .where(and(
      eq(deckPhotos.personId, personId),
      eq(deckPhotos.deckId, deck.id)
    ))
    .orderBy(asc(deckPhotos.createdAt))
    .limit(MAX_PERSON_REFERENCE_PHOTOS)

  if (!referencePhotos.length) {
    throw createError({ status: 400, message: 'Cette personne n\'a aucune photo de référence' })
  }

  await db.transaction(async (tx) => {
    await tx
      .update(decks)
      .set({ status: 'generating', updatedAt: new Date() })
      .where(eq(decks.id, deck.id))

    await tx
      .update(deckCards)
      .set({ status: 'generating', errorMessage: null, updatedAt: new Date() })
      .where(eq(deckCards.id, card.id))
  })

  try {
    const referenceBuffers = await Promise.all(
      referencePhotos.map(photo => readPhotoBuffer(photo.url))
    )
    const scenePrompt = buildCardScenePrompt(card.metadata, deck.settings, card.prompt)
    const foregroundPrompt = buildCardForegroundPrompt(card.metadata, deck.settings, card.prompt)
    const imageProviderOptions = {
      google: {
        responseModalities: ['TEXT', 'IMAGE'] as Array<'TEXT' | 'IMAGE'>
      }
    }

    async function generateWithRetry(
      label: string,
      input: Parameters<typeof generateImage>[0]
    ) {
      let lastError: unknown

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const result = await generateImage(input)

          if (result.image?.uint8Array?.byteLength) {
            return result
          }

          lastError = new Error(`Aucune image générée (${label}, tentative ${attempt})`)
        } catch (error) {
          lastError = error
        }
      }

      throw lastError instanceof Error ? lastError : new Error(`Génération impossible (${label})`)
    }

    const [sceneResult, foregroundResult] = await Promise.all([
      generateWithRetry('décor', {
        model: aiImageModel,
        prompt: scenePrompt,
        aspectRatio: card.metadata.aspectRatio,
        providerOptions: imageProviderOptions
      }),
      generateWithRetry('personnage', {
        model: aiImageModel,
        prompt: {
          text: foregroundPrompt,
          images: referenceBuffers
        },
        aspectRatio: card.metadata.aspectRatio,
        providerOptions: imageProviderOptions
      })
    ])
    const image = sceneResult.image
    const foregroundImage = foregroundResult.image

    if (!image?.uint8Array || !foregroundImage?.uint8Array) {
      throw new Error('Aucune image générée')
    }

    const rawBuffer = Buffer.from(image.uint8Array)
    const rawMediaType = image.mediaType || 'image/png'
    const rawExtension = mediaTypeToExtension(rawMediaType)
    const prefix = `users/${session.user.id}/decks/${deck.id}/cards/${card.id}`
    const rawImageKey = generateFileKey(prefix, `raw.${rawExtension}`)
    const rawImageUrl = await uploadFile(rawBuffer, rawImageKey, rawMediaType)
    const finalBuffer = await renderCardImage(rawBuffer, card.metadata, Buffer.from(foregroundImage.uint8Array))
    const finalImageKey = generateFileKey(prefix, 'final.png')
    const finalImageUrl = await uploadFile(finalBuffer, finalImageKey, 'image/png')

    const [updatedCard] = await db
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
      .where(eq(deckCards.id, card.id))
      .returning()

    await updateDeckProgress(deck.id)

    return updatedCard
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Génération impossible'

    await db.transaction(async (tx) => {
      await tx
        .update(deckCards)
        .set({ status: 'failed', errorMessage: message, updatedAt: new Date() })
        .where(eq(deckCards.id, card.id))

      await tx
        .update(decks)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(decks.id, deck.id))
    })

    throw createError({ status: 500, message })
  }
})
