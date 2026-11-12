import { and, eq } from 'drizzle-orm'
import { buildCardForegroundPrompt, buildCardScenePrompt, getCardPromptLayers } from '~~/server/utils/cardPromptBuilder'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckCards, deckPersons } from '~~/server/utils/db'

/**
 * What a generation of this card will send to the image model: the prompt
 * layers in their order of application, and the two final prompts.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')
  const cardId = getRouterParam(event, 'cardId')

  if (!deckId || !cardId) {
    throw createError({ status: 400, message: 'Carte manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const [card] = await db
    .select()
    .from(deckCards)
    .where(and(eq(deckCards.id, cardId), eq(deckCards.deckId, deck.id), eq(deckCards.userId, session.user.id)))
    .limit(1)

  if (!card) {
    throw createError({ status: 404, message: 'Carte introuvable' })
  }

  const [person] = card.sourcePersonId
    ? await db
        .select({ label: deckPersons.label, prompt: deckPersons.prompt })
        .from(deckPersons)
        .where(and(eq(deckPersons.id, card.sourcePersonId), eq(deckPersons.deckId, deck.id)))
        .limit(1)
    : []

  const options = { cardPrompt: card.prompt, person: person ?? null }

  return {
    layers: getCardPromptLayers(card.metadata, deck.settings, options),
    scene: buildCardScenePrompt(card.metadata, deck.settings, options),
    character: buildCardForegroundPrompt(card.metadata, deck.settings, options)
  }
})
