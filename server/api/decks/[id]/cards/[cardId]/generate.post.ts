import { and, eq } from 'drizzle-orm'
import { generatePersonCardFace, loadCardPerson } from '~~/server/utils/cardFaceGeneration'
import { renderAndStoreClassicCard, updateDeckProgress } from '~~/server/utils/classicCards'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckCards, decks } from '~~/server/utils/db'
import { assertCanGenerate } from '~~/server/utils/generationAccess'
import { normalizeGenerationError } from '~~/server/utils/generationErrors'
import { usesClassicDesign } from '~~/shared/utils/classicCards'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { email: string, id: string } }
  const deckId = getRouterParam(event, 'id')
  const cardId = getRouterParam(event, 'cardId')

  if (!deckId || !cardId) {
    throw createError({ status: 400, message: 'Carte manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const [card] = await db
    .select()
    .from(deckCards)
    .where(and(
      eq(deckCards.id, cardId),
      eq(deckCards.deckId, deck.id),
      eq(deckCards.userId, session.user.id)
    ))
    .limit(1)

  if (!card) {
    throw createError({ status: 404, message: 'Carte introuvable' })
  }

  // Aces and numerals use the classic pip design: drawn locally, no AI, no person.
  if (usesClassicDesign(card.metadata.role, deck.settings)) {
    try {
      const updated = await renderAndStoreClassicCard(deck, card)
      await updateDeckProgress(deck.id)
      return updated
    } catch (error) {
      console.error('[card.generate] classic render failed', { deckId: deck.id, cardId: card.id, error })
      throw createError({ status: 500, message: 'Dessin de la carte classique impossible' })
    }
  }

  assertCanGenerate(session.user)
  const personId = card.sourcePersonId

  if (!personId) {
    throw createError({ status: 400, message: 'Affectez une personne à cette carte avant le test' })
  }

  const person = await loadCardPerson(deck.id, personId)

  await db.transaction(async (tx) => {
    await tx
      .update(decks)
      .set({ status: 'generating', updatedAt: new Date() })
      .where(eq(decks.id, deck.id))

    await tx
      .update(deckCards)
      .set({ status: 'generating', errorMessage: null, updatedAt: new Date() })
      .where(eq(deckCards.id, card.id))
  })

  const currentCard = card

  try {
    const face = await generatePersonCardFace({
      deckId: deck.id,
      cardId: currentCard.id,
      settings: deck.settings,
      metadata: currentCard.metadata,
      cardPrompt: currentCard.prompt,
      person,
      storagePrefix: `users/${session.user.id}/decks/${deck.id}/cards/${currentCard.id}`
    })

    const [updatedCard] = await db
      .update(deckCards)
      .set({
        status: 'ready',
        rawImageKey: face.rawImageKey,
        rawImageUrl: face.rawImageUrl,
        finalImageKey: face.finalImageKey,
        finalImageUrl: face.finalImageUrl,
        // Remember the format this face was rendered in (decks can change format).
        metadata: { ...currentCard.metadata, format: face.format, foregroundImageUrl: face.foregroundImageUrl },
        errorMessage: null,
        updatedAt: new Date()
      })
      .where(eq(deckCards.id, currentCard.id))
      .returning()

    await updateDeckProgress(deck.id)

    return updatedCard
  } catch (error) {
    const normalized = normalizeGenerationError(error)

    console.error('[card.generate] failed', {
      deckId: deck.id,
      cardId: currentCard.id,
      cardLabel: currentCard.metadata.label,
      code: normalized.code,
      message: normalized.message,
      cause: normalized.cause
    })

    const [failedCard] = await db
      .update(deckCards)
      .set({
        status: 'failed',
        errorMessage: normalized.message,
        updatedAt: new Date()
      })
      .where(eq(deckCards.id, currentCard.id))
      .returning()

    await updateDeckProgress(deck.id)

    throw createError({
      status: normalized.status,
      message: normalized.message,
      data: {
        code: normalized.code,
        cardId: currentCard.id,
        card: failedCard
      }
    })
  }
})
