import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckCards, deckPhotos } from '~~/server/utils/db'

const cardRoleSchema = z.enum(['number', 'ace', 'jack', 'knight', 'queen', 'king', 'trump', 'excuse'])

const assignmentSchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('card'),
    cardId: z.string().min(1),
    photoId: z.string().min(1).nullable()
  }),
  z.object({
    scope: z.literal('role'),
    role: cardRoleSchema,
    photoId: z.string().min(1).nullable()
  })
])

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const body = await readBody(event)
  const result = assignmentSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      status: 400,
      message: 'Données invalides',
      data: result.error.flatten()
    })
  }

  const input = result.data

  if (input.photoId) {
    const [photo] = await db
      .select({ id: deckPhotos.id })
      .from(deckPhotos)
      .where(and(
        eq(deckPhotos.id, input.photoId),
        eq(deckPhotos.deckId, deck.id),
        eq(deckPhotos.userId, session.user.id)
      ))
      .limit(1)

    if (!photo) {
      throw createError({ status: 404, message: 'Photo introuvable' })
    }
  }

  const cards = await db
    .select({ id: deckCards.id, metadata: deckCards.metadata })
    .from(deckCards)
    .where(and(eq(deckCards.deckId, deck.id), eq(deckCards.userId, session.user.id)))

  const targetIds = input.scope === 'card'
    ? cards.filter(card => card.id === input.cardId).map(card => card.id)
    : cards.filter(card => card.metadata.role === input.role).map(card => card.id)

  if (!targetIds.length) {
    throw createError({ status: 404, message: 'Aucune carte correspondante' })
  }

  await db
    .update(deckCards)
    .set({
      sourcePhotoId: input.photoId,
      updatedAt: new Date()
    })
    .where(and(eq(deckCards.deckId, deck.id), inArray(deckCards.id, targetIds)))

  return {
    assignedCount: targetIds.length,
    photoId: input.photoId,
    scope: input.scope
  }
})
