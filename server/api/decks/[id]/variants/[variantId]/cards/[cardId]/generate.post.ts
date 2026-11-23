import { eq } from 'drizzle-orm'
import { generatePersonCardFace, loadCardPerson } from '~~/server/utils/cardFaceGeneration'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { findVariantCard, requireDeckCard, requireOwnedVariant, serializeVariantCard } from '~~/server/utils/deckVariants'
import { db, deckVariantCards } from '~~/server/utils/db'
import { assertCanGenerate } from '~~/server/utils/generationAccess'
import { normalizeGenerationError } from '~~/server/utils/generationErrors'

/** Generate the face of a card overridden in a variant (deck card left untouched). */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { email: string, id: string } }
  const deckId = getRouterParam(event, 'id')
  const variantId = getRouterParam(event, 'variantId')
  const cardId = getRouterParam(event, 'cardId')

  if (!deckId || !variantId || !cardId) {
    throw createError({ status: 400, message: 'Carte manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const variant = await requireOwnedVariant(deck.id, variantId, session.user.id)
  const baseCard = await requireDeckCard(deck.id, cardId, session.user.id)
  const override = await findVariantCard(variant.id, baseCard.id)

  if (!override) {
    throw createError({ status: 404, message: 'Cette carte n\'est pas modifiée dans la variante' })
  }

  assertCanGenerate(session.user)

  if (!override.sourcePersonId) {
    throw createError({ status: 400, message: 'Choisissez une personne pour cette carte avant de la générer' })
  }

  const person = await loadCardPerson(deck.id, override.sourcePersonId)

  await db
    .update(deckVariantCards)
    .set({ status: 'generating', errorMessage: null, updatedAt: new Date() })
    .where(eq(deckVariantCards.id, override.id))

  try {
    const face = await generatePersonCardFace({
      deckId: deck.id,
      cardId: baseCard.id,
      settings: deck.settings,
      metadata: baseCard.metadata,
      // Same prompt as the deck card unless the variant sets its own.
      cardPrompt: override.prompt ?? baseCard.prompt,
      person,
      storagePrefix: `users/${session.user.id}/decks/${deck.id}/variants/${variant.id}/cards/${baseCard.id}`
    })

    const [updated] = await db
      .update(deckVariantCards)
      .set({
        status: 'ready',
        rawImageKey: face.rawImageKey,
        rawImageUrl: face.rawImageUrl,
        finalImageKey: face.finalImageKey,
        finalImageUrl: face.finalImageUrl,
        metadata: { format: face.format, layoutVersion: face.layoutVersion, foregroundImageUrl: face.foregroundImageUrl },
        errorMessage: null,
        updatedAt: new Date()
      })
      .where(eq(deckVariantCards.id, override.id))
      .returning()

    return serializeVariantCard(updated!)
  } catch (error) {
    const normalized = normalizeGenerationError(error)

    console.error('[variant-card.generate] failed', {
      deckId: deck.id,
      variantId: variant.id,
      cardId: baseCard.id,
      code: normalized.code,
      message: normalized.message,
      cause: normalized.cause
    })

    const [failed] = await db
      .update(deckVariantCards)
      .set({ status: 'failed', errorMessage: normalized.message, updatedAt: new Date() })
      .where(eq(deckVariantCards.id, override.id))
      .returning()

    throw createError({
      status: normalized.status,
      message: normalized.message,
      data: {
        code: normalized.code,
        cardId: baseCard.id,
        card: failed ? serializeVariantCard(failed) : null
      }
    })
  }
})
