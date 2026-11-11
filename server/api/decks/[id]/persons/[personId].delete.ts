import { and, count, eq } from 'drizzle-orm'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckCards, deckPersons, deckPhotos, decks } from '~~/server/utils/db'
import { deleteFile } from '~~/server/utils/s3'

/**
 * Delete a person from a deck.
 *
 * The database does the rest: their reference photos cascade, and the cards
 * they were assigned to are detached (source person / photo set to null).
 * Faces already generated keep their image.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')
  const personId = getRouterParam(event, 'personId')

  if (!deckId || !personId) {
    throw createError({ status: 400, message: 'Personne manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const ownedPerson = and(
    eq(deckPersons.id, personId),
    eq(deckPersons.deckId, deck.id),
    eq(deckPersons.userId, session.user.id)
  )

  const [person] = await db.select({ id: deckPersons.id }).from(deckPersons).where(ownedPerson).limit(1)

  if (!person) {
    throw createError({ status: 404, message: 'Personne introuvable' })
  }

  const photos = await db
    .select({ storageKey: deckPhotos.storageKey })
    .from(deckPhotos)
    .where(and(eq(deckPhotos.personId, person.id), eq(deckPhotos.deckId, deck.id)))
  const [assigned] = await db
    .select({ value: count() })
    .from(deckCards)
    .where(and(eq(deckCards.deckId, deck.id), eq(deckCards.sourcePersonId, person.id)))

  await db.delete(deckPersons).where(ownedPerson)
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deck.id))

  // Storage cleanup is best effort: the rows are already gone.
  await Promise.allSettled(photos.map(photo => deleteFile(photo.storageKey).catch((error) => {
    console.warn('[persons.delete] photo file not removed', { key: photo.storageKey, message: error instanceof Error ? error.message : String(error) })
  })))

  return {
    deletedPhotos: photos.length,
    unassignedCards: assigned?.value ?? 0
  }
})
