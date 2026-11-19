import { and, eq } from 'drizzle-orm'
import { buildCardForegroundPrompt, buildCardScenePrompt, getCardPromptLayers } from '~~/server/utils/cardPromptBuilder'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { findVariantCard, requireDeckCard, requireOwnedVariant } from '~~/server/utils/deckVariants'
import { db, deckPersons } from '~~/server/utils/db'

/** Same as the deck card prompt preview, with the variant's person and prompt. */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
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
  const personId = override ? override.sourcePersonId : baseCard.sourcePersonId

  const [person] = personId
    ? await db
        .select({ label: deckPersons.label, prompt: deckPersons.prompt })
        .from(deckPersons)
        .where(and(eq(deckPersons.id, personId), eq(deckPersons.deckId, deck.id)))
        .limit(1)
    : []

  const options = { cardPrompt: override?.prompt ?? baseCard.prompt, person: person ?? null }

  return {
    layers: getCardPromptLayers(baseCard.metadata, deck.settings, options),
    scene: buildCardScenePrompt(baseCard.metadata, deck.settings, options),
    character: buildCardForegroundPrompt(baseCard.metadata, deck.settings, options)
  }
})
