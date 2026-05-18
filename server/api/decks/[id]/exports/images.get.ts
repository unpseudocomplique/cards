import { and, eq, isNotNull } from 'drizzle-orm'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckCards } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const cards = await db
    .select({
      cardCode: deckCards.cardCode,
      metadata: deckCards.metadata,
      finalImageUrl: deckCards.finalImageUrl
    })
    .from(deckCards)
    .where(and(eq(deckCards.deckId, deck.id), isNotNull(deckCards.finalImageUrl)))

  return {
    deckId: deck.id,
    count: cards.length,
    cards
  }
})
