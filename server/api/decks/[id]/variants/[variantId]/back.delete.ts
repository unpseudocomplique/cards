import { eq } from 'drizzle-orm'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { requireOwnedVariant, serializeVariant } from '~~/server/utils/deckVariants'
import { db, deckVariants } from '~~/server/utils/db'

/** Drop the variant back: the variant uses the deck back again. */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')
  const variantId = getRouterParam(event, 'variantId')

  if (!deckId || !variantId) {
    throw createError({ status: 400, message: 'Variante manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const variant = await requireOwnedVariant(deck.id, variantId, session.user.id)

  const [updated] = await db
    .update(deckVariants)
    .set({ backPrompt: null, backImageKey: null, backImageUrl: null, backFormat: null, updatedAt: new Date() })
    .where(eq(deckVariants.id, variant.id))
    .returning()

  return serializeVariant(updated!)
})
