import { and, asc, eq, isNull } from 'drizzle-orm'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckCards, deckPhotos } from '~~/server/utils/db'
import { deleteFile } from '~~/server/utils/s3'

/**
 * Delete one reference photo of a person.
 *
 * Cards pointing at it get the person's next photo as their source, so they
 * stay assigned to the same person. Generation always uses all of the
 * person's remaining photos.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')
  const photoId = getRouterParam(event, 'photoId')

  if (!deckId || !photoId) {
    throw createError({ status: 400, message: 'Photo manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const [photo] = await db
    .select({ id: deckPhotos.id, personId: deckPhotos.personId, storageKey: deckPhotos.storageKey })
    .from(deckPhotos)
    .where(and(
      eq(deckPhotos.id, photoId),
      eq(deckPhotos.deckId, deck.id),
      eq(deckPhotos.userId, session.user.id)
    ))
    .limit(1)

  if (!photo) {
    throw createError({ status: 404, message: 'Photo introuvable' })
  }

  // The foreign key detaches cards from the photo (source photo set to null).
  await db.delete(deckPhotos).where(eq(deckPhotos.id, photo.id))

  let remainingPhotos = 0

  if (photo.personId) {
    const remaining = await db
      .select({ id: deckPhotos.id })
      .from(deckPhotos)
      .where(and(eq(deckPhotos.personId, photo.personId), eq(deckPhotos.deckId, deck.id)))
      .orderBy(asc(deckPhotos.createdAt))
    remainingPhotos = remaining.length

    if (remaining[0]) {
      await db
        .update(deckCards)
        .set({ sourcePhotoId: remaining[0].id, updatedAt: new Date() })
        .where(and(
          eq(deckCards.deckId, deck.id),
          eq(deckCards.sourcePersonId, photo.personId),
          isNull(deckCards.sourcePhotoId)
        ))
    }
  }

  await deleteFile(photo.storageKey).catch((error) => {
    console.warn('[photos.delete] file not removed', { key: photo.storageKey, message: error instanceof Error ? error.message : String(error) })
  })

  return { remainingPhotos }
})
