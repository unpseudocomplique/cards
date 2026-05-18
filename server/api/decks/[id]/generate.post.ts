import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckCards, decks, generationJobs } from '~~/server/utils/db'

const cardRoleSchema = z.enum(['number', 'ace', 'jack', 'knight', 'queen', 'king', 'trump', 'excuse'])

const generateSchema = z.object({
  scope: z.enum(['pending', 'cards', 'role']).default('pending'),
  cardIds: z.array(z.string().min(1)).max(78).optional(),
  role: cardRoleSchema.optional()
}).default({ scope: 'pending' })

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const body = await readBody(event).catch(() => undefined)
  const result = generateSchema.safeParse(body || {})

  if (!result.success) {
    throw createError({
      status: 400,
      message: 'Sélection invalide',
      data: result.error.flatten()
    })
  }

  const input = result.data
  const cards = await db
    .select({ id: deckCards.id, status: deckCards.status, metadata: deckCards.metadata })
    .from(deckCards)
    .where(and(eq(deckCards.deckId, deck.id), eq(deckCards.userId, session.user.id)))

  const targetIds = (() => {
    if (input.scope === 'cards') {
      return cards
        .filter(card => input.cardIds?.includes(card.id))
        .map(card => card.id)
    }

    if (input.scope === 'role') {
      return cards
        .filter(card => card.metadata.role === input.role)
        .map(card => card.id)
    }

    return cards
      .filter(card => card.status === 'pending')
      .map(card => card.id)
  })()

  if (!targetIds.length) {
    throw createError({ status: 400, message: 'Aucune carte à générer' })
  }

  const nextReadyCardCount = cards.filter(card => card.status === 'ready' && !targetIds.includes(card.id)).length

  const [job] = await db.transaction(async (tx) => {
    await tx
      .update(decks)
      .set({ status: 'queued', readyCardCount: nextReadyCardCount, updatedAt: new Date() })
      .where(eq(decks.id, deck.id))

    await tx
      .update(deckCards)
      .set({ status: 'queued', errorMessage: null, updatedAt: new Date() })
      .where(and(eq(deckCards.deckId, deck.id), inArray(deckCards.id, targetIds)))

    return tx
      .insert(generationJobs)
      .values({
        deckId: deck.id,
        userId: session.user.id,
        totalCards: targetIds.length
      })
      .returning()
  })

  return job
})
