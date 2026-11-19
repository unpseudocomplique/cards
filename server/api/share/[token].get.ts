import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import { db, deckCards, decks, users } from '~~/server/utils/db'
import type { SharedDeck } from '~~/shared/types/sharedDeck'

/**
 * Public, read-only view of a shared deck. No session needed: the token is the
 * credential. Only finished faces and display settings leave the server — no
 * source photos, persons, prompts or ids that the owner's API accepts.
 */
export default defineEventHandler(async (event): Promise<SharedDeck> => {
  const token = getRouterParam(event, 'token')

  if (!token || token.length < 16) {
    throw createError({ status: 404, message: 'Lien de partage introuvable' })
  }

  const [deck] = await db
    .select({
      id: decks.id,
      title: decks.title,
      description: decks.description,
      type: decks.type,
      settings: decks.settings,
      cardCount: decks.cardCount,
      ownerName: users.username
    })
    .from(decks)
    .innerJoin(users, eq(users.id, decks.userId))
    .where(and(eq(decks.shareToken, token), isNull(decks.deletedAt)))
    .limit(1)

  if (!deck) {
    throw createError({ status: 404, message: 'Lien de partage introuvable' })
  }

  const cards = await db
    .select({
      id: deckCards.id,
      metadata: deckCards.metadata,
      finalImageUrl: deckCards.finalImageUrl
    })
    .from(deckCards)
    .where(and(eq(deckCards.deckId, deck.id), eq(deckCards.status, 'ready'), isNotNull(deckCards.finalImageUrl)))
    .orderBy(asc(deckCards.sortOrder))

  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex')

  return {
    title: deck.title,
    description: deck.description,
    type: deck.type,
    ownerName: deck.ownerName,
    cardCount: deck.cardCount,
    colorTheme: deck.settings.colorTheme ?? null,
    cardFormat: deck.settings.cardFormat ?? null,
    backImageUrl: deck.settings.cardBackImageUrl ?? null,
    cards: cards.map((card, index) => ({
      // Position, not the database id: nothing here can be fed back to the owner API.
      key: index,
      label: card.metadata.label,
      shortLabel: card.metadata.shortLabel,
      suit: card.metadata.suit ?? null,
      role: card.metadata.role ?? null,
      imageUrl: card.finalImageUrl!
    }))
  }
})
