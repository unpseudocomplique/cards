import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, decks } from '~~/server/utils/db'

const updateDeckPromptSchema = z.object({
  visualStyle: z.string().trim().min(3, 'Prompt global trop court').max(1200, 'Prompt global trop long')
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const body = await readBody(event)
  const result = updateDeckPromptSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      status: 400,
      message: 'Prompt invalide',
      data: result.error.flatten()
    })
  }

  const [updatedDeck] = await db
    .update(decks)
    .set({
      settings: {
        ...deck.settings,
        visualStyle: result.data.visualStyle
      },
      updatedAt: new Date()
    })
    .where(eq(decks.id, deck.id))
    .returning()

  return updatedDeck
})
