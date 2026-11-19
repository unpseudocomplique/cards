import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, asc, eq } from 'drizzle-orm'
import { generateCardImage } from '~~/server/utils/ai'
import { buildCardForegroundPrompt, buildCardScenePrompt } from '~~/server/utils/cardPromptBuilder'
import { renderCardImage } from '~~/server/utils/cardRenderer'
import { MAX_PERSON_REFERENCE_PHOTOS } from '~~/server/utils/deckPersons'
import { db, deckPersons, deckPhotos, type DeckCardMetadata, type DeckStyleSettings } from '~~/server/utils/db'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'
import { resolveDeckCardFormat, type CardFormatId } from '~~/shared/utils/printSpec'

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

/**
 * Reference photos and prompt layer of the person on a card. Throws a 400
 * when the person has no photo, before anything is marked as generating.
 */
export async function loadCardPerson(deckId: string, personId: string) {
  const referencePhotos = await db
    .select()
    .from(deckPhotos)
    .where(and(
      eq(deckPhotos.personId, personId),
      eq(deckPhotos.deckId, deckId)
    ))
    .orderBy(asc(deckPhotos.createdAt))
    .limit(MAX_PERSON_REFERENCE_PHOTOS)

  if (!referencePhotos.length) {
    throw createError({ status: 400, message: 'Cette personne n\'a aucune photo de référence' })
  }

  const [person] = await db
    .select({ label: deckPersons.label, prompt: deckPersons.prompt })
    .from(deckPersons)
    .where(and(eq(deckPersons.id, personId), eq(deckPersons.deckId, deckId)))
    .limit(1)

  return { referencePhotos, person }
}

export type GeneratedCardFace = {
  rawImageKey: string
  rawImageUrl: string
  finalImageKey: string
  finalImageUrl: string
  format: CardFormatId
  foregroundImageUrl: string
}

/**
 * Generate an illustrated face with a person: AI scene + AI character from the
 * reference photos, composed into the deck frame and stored under `storagePrefix`.
 * Shared by the deck cards and the cards a variant overrides.
 */
export async function generatePersonCardFace(options: {
  deckId: string
  cardId: string
  settings: DeckStyleSettings
  metadata: DeckCardMetadata
  cardPrompt: string | null
  person: Awaited<ReturnType<typeof loadCardPerson>>
  storagePrefix: string
}): Promise<GeneratedCardFace> {
  const { deckId, cardId, settings, metadata } = options
  const referenceBuffers = await Promise.all(
    options.person.referencePhotos.map(photo => readPhotoBuffer(photo.url))
  )
  const format = resolveDeckCardFormat(settings)
  // Layered prompt: deck → suit → card rank → person → this card (later wins).
  const promptOptions = { cardPrompt: options.cardPrompt, person: options.person.person }
  const scenePrompt = buildCardScenePrompt(metadata, settings, promptOptions)
  const foregroundPrompt = buildCardForegroundPrompt(metadata, settings, promptOptions)
  const imageProviderOptions = {
    google: {
      responseModalities: ['TEXT', 'IMAGE'] as Array<'TEXT' | 'IMAGE'>
    }
  }

  async function generateWithRetry(
    label: string,
    input: Parameters<typeof generateCardImage>[0]
  ) {
    let lastError: unknown

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await generateCardImage(input)

        if (result.image?.uint8Array?.byteLength) {
          return result
        }

        lastError = new Error(`Aucune image générée (${label}, tentative ${attempt}/3)`)
        console.warn('[card.generate] empty image', { deckId, cardId, label, attempt })
      } catch (error) {
        lastError = error
        console.warn('[card.generate] attempt failed', {
          deckId,
          cardId,
          label,
          attempt,
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`Génération impossible (${label})`)
  }

  const [sceneResult, foregroundResult] = await Promise.all([
    generateWithRetry('décor', {
      prompt: scenePrompt,
      aspectRatio: format.artAspectRatio,
      providerOptions: imageProviderOptions
    }),
    generateWithRetry('personnage', {
      prompt: {
        text: foregroundPrompt,
        images: referenceBuffers
      },
      aspectRatio: format.artAspectRatio,
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
  const foregroundBuffer = Buffer.from(foregroundImage.uint8Array)
  const foregroundMediaType = foregroundImage.mediaType || 'image/png'
  const foregroundExtension = mediaTypeToExtension(foregroundMediaType)
  const prefix = options.storagePrefix
  const rawImageKey = generateFileKey(prefix, `scene.${rawExtension}`)
  const rawImageUrl = await uploadFile(rawBuffer, rawImageKey, rawMediaType)
  // Character layer kept so the card can be recomposed later without a new AI call.
  const foregroundImageUrl = await uploadFile(
    foregroundBuffer,
    generateFileKey(prefix, `foreground.${foregroundExtension}`),
    foregroundMediaType
  )
  const finalBuffer = await renderCardImage(rawBuffer, metadata, foregroundBuffer, {
    theme: settings.colorTheme,
    format: format.id
  }).catch((error) => {
    throw new Error(`Assemblage de la carte impossible: ${error instanceof Error ? error.message : 'erreur inconnue'}`)
  })
  const finalImageKey = generateFileKey(prefix, 'final.png')
  const finalImageUrl = await uploadFile(finalBuffer, finalImageKey, 'image/png')

  return {
    rawImageKey,
    rawImageUrl,
    finalImageKey,
    finalImageUrl,
    format: format.id,
    foregroundImageUrl
  }
}
