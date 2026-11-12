import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckPersons } from '~~/server/utils/db'

const updatePersonSchema = z.object({
  label: z.string().trim().min(1, 'Nom requis').max(80, 'Nom trop long').optional(),
  /** Prompt layer for every card of this person; null or empty clears it. */
  prompt: z.string().trim().max(1200, 'Consigne trop longue').nullable().optional()
}).refine(input => input.label !== undefined || input.prompt !== undefined, {
  message: 'Rien à enregistrer'
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')
  const personId = getRouterParam(event, 'personId')

  if (!deckId || !personId) {
    throw createError({ status: 400, message: 'Personne manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const body = await readBody(event)
  const result = updatePersonSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      status: 400,
      message: result.error.issues[0]?.message ?? 'Données invalides',
      data: result.error.flatten()
    })
  }

  const [person] = await db
    .update(deckPersons)
    .set({
      ...(result.data.label !== undefined ? { label: result.data.label } : {}),
      ...(result.data.prompt !== undefined ? { prompt: result.data.prompt || null } : {}),
      updatedAt: new Date()
    })
    .where(and(
      eq(deckPersons.id, personId),
      eq(deckPersons.deckId, deck.id),
      eq(deckPersons.userId, session.user.id)
    ))
    .returning()

  if (!person) {
    throw createError({ status: 404, message: 'Personne introuvable' })
  }

  return person
})
