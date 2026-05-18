import { eq } from 'drizzle-orm'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, decks } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const deletedAt = new Date()
  const [deletedDeck] = await db
    .update(decks)
    .set({
      deletedAt,
      updatedAt: deletedAt
    })
    .where(eq(decks.id, deck.id))
    .returning({ id: decks.id, deletedAt: decks.deletedAt })

  return deletedDeck
})
