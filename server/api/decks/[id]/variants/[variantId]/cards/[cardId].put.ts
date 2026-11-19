import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { findVariantCard, requireDeckCard, requireOwnedVariant, serializeVariantCard } from '~~/server/utils/deckVariants'
import { db, deckPersons, deckPhotos, deckVariantCards } from '~~/server/utils/db'
import { parseBody } from '~~/server/utils/validation'
import { usesClassicDesign } from '~~/shared/utils/classicCards'

const overrideSchema = z.object({
  /** Person on this card in the variant. Omitted = keep the current one. */
  personId: z.string().min(1).nullable().optional(),
  /** Prompt of this card in the variant. null = same as the deck card. */
  prompt: z.string().trim().max(1200, 'Consigne trop longue').nullable().optional()
})

/** Override one card in a variant (creates the override on first call). */
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
  const input = parseBody(overrideSchema, await readBody(event))

  if (usesClassicDesign(baseCard.metadata.role, deck.settings)) {
    throw createError({ status: 400, message: 'Les cartes au design classique sont les mêmes dans toutes les variantes' })
  }

  const existing = await findVariantCard(variant.id, baseCard.id)
  // A new override starts from the deck card's person, so only what changes has to be picked.
  const personId = input.personId !== undefined
    ? input.personId
    : existing ? existing.sourcePersonId : baseCard.sourcePersonId
  let sourcePhotoId: string | null = null

  if (personId) {
    const [person] = await db
      .select({ id: deckPersons.id })
      .from(deckPersons)
      .where(and(eq(deckPersons.id, personId), eq(deckPersons.deckId, deck.id), eq(deckPersons.userId, session.user.id)))
      .limit(1)

    if (!person) {
      throw createError({ status: 404, message: 'Personne introuvable' })
    }

    const [photo] = await db
      .select({ id: deckPhotos.id })
      .from(deckPhotos)
      .where(and(eq(deckPhotos.personId, person.id), eq(deckPhotos.deckId, deck.id)))
      .limit(1)

    if (!photo) {
      throw createError({ status: 400, message: 'Cette personne n\'a aucune photo' })
    }

    sourcePhotoId = photo.id
  }

  const prompt = input.prompt !== undefined
    ? input.prompt?.trim() || null
    : existing?.prompt ?? null

  if (existing) {
    const [updated] = await db
      .update(deckVariantCards)
      .set({ sourcePersonId: personId, sourcePhotoId, prompt, updatedAt: new Date() })
      .where(eq(deckVariantCards.id, existing.id))
      .returning()
    return serializeVariantCard(updated!)
  }

  const [created] = await db
    .insert(deckVariantCards)
    .values({
      variantId: variant.id,
      deckId: deck.id,
      baseCardId: baseCard.id,
      userId: session.user.id,
      sourcePersonId: personId,
      sourcePhotoId,
      prompt
    })
    .returning()

  return serializeVariantCard(created!)
})
