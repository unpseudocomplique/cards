import { and, asc, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { db, deckCards, decks } from '~~/server/utils/db'

/** Roles that make the most recognisable covers, best first. */
const coverRolePriority = ['king', 'queen', 'knight', 'jack', 'trump', 'excuse', 'ace', 'number']
const COVER_SIZE = 3

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }

  const rows = await db
    .select()
    .from(decks)
    .where(and(eq(decks.userId, session.user.id), isNull(decks.deletedAt)))
    .orderBy(desc(decks.updatedAt))

  if (!rows.length) {
    return []
  }

  const readyCards = await db
    .select({
      deckId: deckCards.deckId,
      metadata: deckCards.metadata,
      finalImageUrl: deckCards.finalImageUrl
    })
    .from(deckCards)
    .where(and(
      inArray(deckCards.deckId, rows.map(row => row.id)),
      eq(deckCards.status, 'ready'),
      isNotNull(deckCards.finalImageUrl)
    ))
    .orderBy(asc(deckCards.sortOrder))

  const coversByDeck = new Map<string, Array<{ url: string, rank: number }>>()

  for (const card of readyCards) {
    const role = card.metadata?.role ?? 'number'
    const rank = coverRolePriority.indexOf(role)
    const list = coversByDeck.get(card.deckId) ?? []

    list.push({ url: card.finalImageUrl!, rank: rank === -1 ? coverRolePriority.length : rank })
    coversByDeck.set(card.deckId, list)
  }

  return rows.map(row => ({
    ...row,
    coverUrls: (coversByDeck.get(row.id) ?? [])
      .sort((a, b) => a.rank - b.rank)
      .slice(0, COVER_SIZE)
      .map(cover => cover.url)
  }))
})
