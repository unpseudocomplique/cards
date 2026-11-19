import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { generateCardBack } from '~~/server/utils/cardBackGeneration'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { requireOwnedVariant, serializeVariant } from '~~/server/utils/deckVariants'
import { db, deckVariants } from '~~/server/utils/db'
import { assertCanGenerate } from '~~/server/utils/generationAccess'
import { normalizeGenerationError } from '~~/server/utils/generationErrors'
import { parseBody } from '~~/server/utils/validation'

const bodySchema = z.object({
  prompt: z.string().trim().max(1600, 'Motif trop long').optional()
})

/** Give a variant its own back (the deck back is left untouched). */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { email: string, id: string } }
  assertCanGenerate(session.user)
  const deckId = getRouterParam(event, 'id')
  const variantId = getRouterParam(event, 'variantId')

  if (!deckId || !variantId) {
    throw createError({ status: 400, message: 'Variante manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const variant = await requireOwnedVariant(deck.id, variantId, session.user.id)
  const body = parseBody(bodySchema, (await readBody(event).catch(() => null)) ?? {})
  const prompt = body.prompt?.trim() || variant.backPrompt || null

  try {
    const back = await generateCardBack({
      // Same theme and format as the deck; only the motif changes.
      settings: { ...deck.settings, cardBackPrompt: prompt ?? deck.settings.cardBackPrompt },
      promptOverride: prompt,
      storagePrefix: `users/${session.user.id}/decks/${deck.id}/variants/${variant.id}/back`
    })

    const [updated] = await db
      .update(deckVariants)
      .set({
        backPrompt: prompt,
        backImageKey: back.finalKey,
        backImageUrl: back.finalUrl,
        backFormat: back.format,
        updatedAt: new Date()
      })
      .where(eq(deckVariants.id, variant.id))
      .returning()

    return serializeVariant(updated!)
  } catch (error) {
    const normalized = normalizeGenerationError(error)
    console.error('[variant.back.generate] failed', {
      deckId: deck.id,
      variantId: variant.id,
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
