import { and, asc, eq } from 'drizzle-orm'
import { db, deckCards, deckVariantCards, deckVariants } from '~~/server/utils/db'

type VariantCardRow = typeof deckVariantCards.$inferSelect

export function serializeVariantCard(card: VariantCardRow) {
  return {
    id: card.id,
    variantId: card.variantId,
    baseCardId: card.baseCardId,
    sourcePersonId: card.sourcePersonId,
    sourcePhotoId: card.sourcePhotoId,
    prompt: card.prompt,
    status: card.status,
    metadata: { format: card.metadata.format },
    rawImageUrl: card.rawImageUrl,
    finalImageUrl: card.finalImageUrl,
    errorMessage: card.errorMessage
  }
}

export type DeckVariantCardPayload = ReturnType<typeof serializeVariantCard>

export type DeckVariantPayload = ReturnType<typeof serializeVariant> & {
  cards: DeckVariantCardPayload[]
}

export function serializeVariant(variant: typeof deckVariants.$inferSelect) {
  return {
    id: variant.id,
    name: variant.name,
    /** null = same back as the deck. */
    back: variant.backImageUrl
      ? { prompt: variant.backPrompt, imageUrl: variant.backImageUrl, format: variant.backFormat }
      : null,
    createdAt: variant.createdAt.toISOString()
  }
}

/** Every variant of a deck with the cards it overrides, oldest first. */
export async function listDeckVariants(deckId: string): Promise<DeckVariantPayload[]> {
  const [variants, cards] = await Promise.all([
    db.select().from(deckVariants).where(eq(deckVariants.deckId, deckId)).orderBy(asc(deckVariants.createdAt)),
    db.select().from(deckVariantCards).where(eq(deckVariantCards.deckId, deckId)).orderBy(asc(deckVariantCards.createdAt))
  ])

  return variants.map(variant => ({
    ...serializeVariant(variant),
    cards: cards.filter(card => card.variantId === variant.id).map(serializeVariantCard)
  }))
}

export async function requireOwnedVariant(deckId: string, variantId: string, userId: string) {
  const [variant] = await db
    .select()
    .from(deckVariants)
    .where(and(
      eq(deckVariants.id, variantId),
      eq(deckVariants.deckId, deckId),
      eq(deckVariants.userId, userId)
    ))
    .limit(1)

  if (!variant) {
    throw createError({ status: 404, message: 'Variante introuvable' })
  }

  return variant
}

export async function requireDeckCard(deckId: string, cardId: string, userId: string) {
  const [card] = await db
    .select()
    .from(deckCards)
    .where(and(
      eq(deckCards.id, cardId),
      eq(deckCards.deckId, deckId),
      eq(deckCards.userId, userId)
    ))
    .limit(1)

  if (!card) {
    throw createError({ status: 404, message: 'Carte introuvable' })
  }

  return card
}

export async function findVariantCard(variantId: string, baseCardId: string) {
  const [card] = await db
    .select()
    .from(deckVariantCards)
    .where(and(eq(deckVariantCards.variantId, variantId), eq(deckVariantCards.baseCardId, baseCardId)))
    .limit(1)

  return card ?? null
}
