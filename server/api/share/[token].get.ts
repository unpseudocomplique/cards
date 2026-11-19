import { and, asc, eq, isNull } from 'drizzle-orm'
import { db, deckCards, decks, deckVariantCards, deckVariants, users } from '~~/server/utils/db'
import type { SharedDeck, SharedDeckCard } from '~~/shared/types/sharedDeck'

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

  const [allCards, variants, overrides] = await Promise.all([
    db
      .select({
        id: deckCards.id,
        status: deckCards.status,
        metadata: deckCards.metadata,
        finalImageUrl: deckCards.finalImageUrl
      })
      .from(deckCards)
      .where(eq(deckCards.deckId, deck.id))
      .orderBy(asc(deckCards.sortOrder)),
    db
      .select({ id: deckVariants.id, name: deckVariants.name, backImageUrl: deckVariants.backImageUrl })
      .from(deckVariants)
      .where(eq(deckVariants.deckId, deck.id))
      .orderBy(asc(deckVariants.createdAt)),
    db
      .select({
        variantId: deckVariantCards.variantId,
        baseCardId: deckVariantCards.baseCardId,
        status: deckVariantCards.status,
        finalImageUrl: deckVariantCards.finalImageUrl
      })
      .from(deckVariantCards)
      .where(eq(deckVariantCards.deckId, deck.id))
  ])

  type CardRow = typeof allCards[number]

  // Position, not the database id: nothing here can be fed back to the owner API.
  function toShared(card: CardRow, imageUrl: string, key: number, changed?: boolean): SharedDeckCard {
    return {
      key,
      label: card.metadata.label,
      shortLabel: card.metadata.shortLabel,
      suit: card.metadata.suit ?? null,
      role: card.metadata.role ?? null,
      imageUrl,
      ...(changed ? { changed } : {})
    }
  }

  const cards = allCards.filter(card => card.status === 'ready' && card.finalImageUrl)
  const deckBackUrl = deck.settings.cardBackImageUrl ?? null

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
    backImageUrl: deckBackUrl,
    cards: cards.map((card, index) => toShared(card, card.finalImageUrl!, index)),
    // Each variant is the whole deck with its own faces in place of the cards it changes.
    variants: variants.map((variant, variantIndex) => {
      const own = new Map(overrides
        .filter(override => override.variantId === variant.id)
        .map(override => [override.baseCardId, override.status === 'ready' ? override.finalImageUrl : null]))
      const variantCards: SharedDeckCard[] = []

      for (const card of allCards) {
        const changed = own.has(card.id)
        // A changed card not generated yet is left out, never shown with the deck face.
        const url = changed ? own.get(card.id) : card.status === 'ready' ? card.finalImageUrl : null
        if (url) {
          variantCards.push(toShared(card, url, variantCards.length, changed))
        }
      }

      return {
        key: variantIndex,
        name: variant.name,
        backImageUrl: variant.backImageUrl ?? deckBackUrl,
        cards: variantCards
      }
    })
  }
})
