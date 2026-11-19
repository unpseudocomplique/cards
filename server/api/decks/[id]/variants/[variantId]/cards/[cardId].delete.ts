import { and, eq } from 'drizzle-orm'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { requireOwnedVariant } from '~~/server/utils/deckVariants'
import { db, deckVariantCards } from '~~/server/utils/db'

/** Drop the override: the card follows the deck again in this variant. */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')
  const variantId = getRouterParam(event, 'variantId')
  const cardId = getRouterParam(event, 'cardId')

  if (!deckId || !variantId || !cardId) {
    throw createError({ status: 400, message: 'Carte manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const variant = await requireOwnedVariant(deck.id, variantId, session.user.id)

  await db
    .delete(deckVariantCards)
    .where(and(eq(deckVariantCards.variantId, variant.id), eq(deckVariantCards.baseCardId, cardId)))

  return { variantId: variant.id, baseCardId: cardId, deleted: true }
})
