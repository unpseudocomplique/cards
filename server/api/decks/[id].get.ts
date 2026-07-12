import { asc, eq } from 'drizzle-orm'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { listDeckPersons } from '~~/server/utils/deckPersons'
import { db, deckCards, deckPhotos } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const [cards, photos, persons] = await Promise.all([
    db.select().from(deckCards).where(eq(deckCards.deckId, deck.id)).orderBy(asc(deckCards.sortOrder)),
    db.select().from(deckPhotos).where(eq(deckPhotos.deckId, deck.id)).orderBy(asc(deckPhotos.createdAt)),
    listDeckPersons(deck.id)
  ])

  return {
    deck,
    cards,
    persons,
    photos: photos.map(photo => ({
      id: photo.id,
      personId: photo.personId,
      label: photo.label,
      url: photo.url,
      originalFilename: photo.originalFilename,
      size: photo.size,
      createdAt: photo.createdAt.toISOString()
    }))
  }
})
