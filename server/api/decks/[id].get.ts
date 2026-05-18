import { asc, eq } from 'drizzle-orm'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckCards, deckPhotos } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const [cards, photos] = await Promise.all([
    db.select().from(deckCards).where(eq(deckCards.deckId, deck.id)).orderBy(asc(deckCards.sortOrder)),
    db.select().from(deckPhotos).where(eq(deckPhotos.deckId, deck.id)).orderBy(asc(deckPhotos.createdAt))
  ])

  return {
    deck,
    cards,
    photos
  }
})
