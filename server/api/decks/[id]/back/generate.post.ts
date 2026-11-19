import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { generateCardBack } from '~~/server/utils/cardBackGeneration'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, decks } from '~~/server/utils/db'
import { assertCanGenerate } from '~~/server/utils/generationAccess'
import { normalizeGenerationError } from '~~/server/utils/generationErrors'

const bodySchema = z.object({
  prompt: z.string().trim().max(1600).optional()
}).optional()

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

  try {
    const back = await generateCardBack({
      settings,
      promptOverride,
      storagePrefix: `users/${session.user.id}/decks/${deck.id}/back`
    })
    const finalUrl = back.finalUrl

    const [updatedDeck] = await db
      .update(decks)
      .set({
        settings: {
          ...settings,
          cardBackPrompt: settings.cardBackPrompt || undefined,
          cardBackImageUrl: finalUrl,
          cardBackFormat: back.format,
          cardBackImageKey: back.finalKey
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
