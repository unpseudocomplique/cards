import { generateImage } from 'ai'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { aiImageModel } from '~~/server/utils/ai'
import { buildCardBackPrompt } from '~~/server/utils/cardPromptBuilder'
import { renderCardBackImage } from '~~/server/utils/cardRenderer'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, decks } from '~~/server/utils/db'
import { assertCanGenerate } from '~~/server/utils/generationAccess'
import { normalizeGenerationError } from '~~/server/utils/generationErrors'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'
import { resolveDeckCardFormat } from '~~/shared/utils/printSpec'

const bodySchema = z.object({
  prompt: z.string().trim().max(1600).optional()
}).optional()

function mediaTypeToExtension(mediaType?: string) {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  }

  return extensions[mediaType || ''] || 'png'
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { email: string, id: string } }
  assertCanGenerate(session.user)
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const body = await readBody(event).catch(() => undefined)
  const parsed = bodySchema.safeParse(body || {})

  if (!parsed.success) {
    throw createError({ status: 400, message: 'Prompt invalide' })
  }

  const promptOverride = parsed.data?.prompt?.trim() || null
  // Drop keys of the abandoned foil feature still stored on older decks.
  const { cardBackFoilUrl: _foilUrl, cardBackFoilKey: _foilKey, ...storedSettings } = deck.settings as typeof deck.settings & {
    cardBackFoilUrl?: string | null
    cardBackFoilKey?: string | null
  }
  const settings = {
    ...storedSettings,
    cardBackPrompt: promptOverride || deck.settings.cardBackPrompt
  }
  // One back for the whole deck, in the single deck format.
  const format = resolveDeckCardFormat(deck.settings)
  const aspectRatio = format.backAspectRatio

  try {
    let lastError: unknown
    let image: { uint8Array?: Uint8Array, mediaType?: string } | null = null

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await generateImage({
          model: aiImageModel,
          prompt: buildCardBackPrompt(settings, promptOverride),
          aspectRatio,
          providerOptions: {
            google: {
              responseModalities: ['TEXT', 'IMAGE']
            }
          }
        })

        if (result.image?.uint8Array?.byteLength) {
          image = result.image
          break
        }

        lastError = new Error(`Aucune image générée pour le dos (tentative ${attempt}/3)`)
      } catch (error) {
        lastError = error
      }
    }

    if (!image?.uint8Array) {
      throw lastError instanceof Error ? lastError : new Error('Aucune image générée pour le dos')
    }

    const rawBuffer = Buffer.from(image.uint8Array)
    const mediaType = image.mediaType || 'image/png'
    const extension = mediaTypeToExtension(mediaType)
    const prefix = `users/${session.user.id}/decks/${deck.id}/back`
    const rawKey = generateFileKey(prefix, `raw.${extension}`)
    await uploadFile(rawBuffer, rawKey, mediaType)

    const finalBuffer = await renderCardBackImage(rawBuffer, {
      profile: 'screen',
      theme: settings.colorTheme,
      format: format.id
    })
    const finalKey = generateFileKey(prefix, 'final.png')
    const finalUrl = await uploadFile(finalBuffer, finalKey, 'image/png')

    const [updatedDeck] = await db
      .update(decks)
      .set({
        settings: {
          ...settings,
          cardBackPrompt: settings.cardBackPrompt || undefined,
          cardBackImageUrl: finalUrl,
          cardBackFormat: format.id,
          cardBackImageKey: finalKey
        },
        updatedAt: new Date()
      })
      .where(eq(decks.id, deck.id))
      .returning()

    return {
      deck: updatedDeck,
      cardBackImageUrl: finalUrl
    }
  } catch (error) {
    const normalized = normalizeGenerationError(error)
    console.error('[card.back.generate] failed', {
      deckId: deck.id,
      code: normalized.code,
      message: normalized.message
    })

    throw createError({
      status: normalized.status,
      message: normalized.message,
      data: { code: normalized.code }
    })
  }
})
