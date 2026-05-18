import { and, eq, isNull } from 'drizzle-orm'
import { db, decks } from '~~/server/utils/db'

export async function requireOwnedDeck(deckId: string, userId: string) {
  const [deck] = await db
    .select()
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId), isNull(decks.deletedAt)))
    .limit(1)

  if (!deck) {
    throw createError({
      status: 404,
      message: 'Deck introuvable'
    })
  }

  return deck
}
