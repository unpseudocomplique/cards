import { and, count, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckCards, decks } from '~~/server/utils/db'
import {
  allowedCardFormatsForDeckType,
  cardFormatIds,
  formatTrimLabel,
  getCardFormat,
  resolveCardImageFormat,
  resolveDeckCardFormat
} from '~~/shared/utils/printSpec'

const bodySchema = z.object({
  cardFormat: z.enum(cardFormatIds)
})

/**
 * Switch a deck to another card format.
 *
 * Faces already rendered in another format cannot be reused as-is (the layout
 * and proportions differ), so they go back to "pending" — their image is kept
 * as a reference until the card is regenerated. Switching back restores them.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const parsed = bodySchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({ status: 400, message: 'Format invalide' })
  }

  const target = getCardFormat(parsed.data.cardFormat)

  if (!allowedCardFormatsForDeckType(deck.type).includes(target.id)) {
    throw createError({ status: 400, message: `Ce type de deck ne peut pas utiliser le format ${formatTrimLabel(target)}` })
  }

  if (resolveDeckCardFormat(deck.settings).id === target.id && deck.settings.cardFormat) {
    return { deck, outdatedCount: 0 }
  }

  return db.transaction(async (tx) => {
    const cards = await tx
      .select({ id: deckCards.id, status: deckCards.status, metadata: deckCards.metadata, finalImageUrl: deckCards.finalImageUrl })
      .from(deckCards)
      .where(eq(deckCards.deckId, deck.id))

    const withImage = cards.filter(card => card.finalImageUrl && (card.status === 'ready' || card.status === 'pending'))
    const toReady = withImage.filter(card => card.status !== 'ready' && resolveCardImageFormat(card.metadata).id === target.id)
    const toPending = withImage.filter(card => card.status === 'ready' && resolveCardImageFormat(card.metadata).id !== target.id)

    if (toReady.length) {
      await tx.update(deckCards)
        .set({ status: 'ready', updatedAt: new Date() })
        .where(inArray(deckCards.id, toReady.map(card => card.id)))
    }

    if (toPending.length) {
      await tx.update(deckCards)
        .set({ status: 'pending', updatedAt: new Date() })
        .where(inArray(deckCards.id, toPending.map(card => card.id)))
    }

    const [ready] = await tx
      .select({ value: count() })
      .from(deckCards)
      .where(and(eq(deckCards.deckId, deck.id), eq(deckCards.status, 'ready')))
    const readyCardCount = ready?.value ?? 0
    const outdatedCount = cards.filter(card => card.finalImageUrl && resolveCardImageFormat(card.metadata).id !== target.id).length

    const [updatedDeck] = await tx
      .update(decks)
      .set({
        settings: { ...deck.settings, cardFormat: target.id },
        readyCardCount,
        status: readyCardCount === deck.cardCount ? 'ready' : 'draft',
        updatedAt: new Date()
      })
      .where(eq(decks.id, deck.id))
      .returning()

    return { deck: updatedDeck, outdatedCount }
  })
})
