import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckPhotos } from '~~/server/utils/db'

const renamePhotoSchema = z.object({
  label: z.string().trim().min(1, 'Alias requis').max(80, 'Alias trop long')
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')
  const photoId = getRouterParam(event, 'photoId')

  if (!deckId || !photoId) {
    throw createError({ status: 400, message: 'Photo manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const body = await readBody(event)
  const result = renamePhotoSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      status: 400,
      message: 'Alias invalide',
      data: result.error.flatten()
    })
  }

  const [photo] = await db
    .update(deckPhotos)
    .set({ label: result.data.label })
    .where(and(
      eq(deckPhotos.id, photoId),
      eq(deckPhotos.deckId, deck.id),
      eq(deckPhotos.userId, session.user.id)
    ))
    .returning()

  if (!photo) {
    throw createError({ status: 404, message: 'Photo introuvable' })
  }

  return photo
})
