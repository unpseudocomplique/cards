import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckCards } from '~~/server/utils/db'

const updateCardPromptSchema = z.object({
  prompt: z.string().trim().max(1200, 'Prompt trop long').nullable()
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')
  const cardId = getRouterParam(event, 'cardId')

  if (!deckId || !cardId) {
    throw createError({ status: 400, message: 'Carte manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const body = await readBody(event)
  const result = updateCardPromptSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      status: 400,
      message: 'Prompt invalide',
      data: result.error.flatten()
    })
  }

  const prompt = result.data.prompt?.trim() || null
  const [card] = await db
    .update(deckCards)
    .set({
      prompt,
      updatedAt: new Date()
    })
    .where(and(
      eq(deckCards.id, cardId),
      eq(deckCards.deckId, deck.id),
      eq(deckCards.userId, session.user.id)
    ))
    .returning()

  if (!card) {
    throw createError({ status: 404, message: 'Carte introuvable' })
  }

  return card
})
