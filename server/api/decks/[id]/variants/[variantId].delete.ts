import { eq } from 'drizzle-orm'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { requireOwnedVariant } from '~~/server/utils/deckVariants'
import { db, deckVariants } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')
  const variantId = getRouterParam(event, 'variantId')

  if (!deckId || !variantId) {
    throw createError({ status: 400, message: 'Variante manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const variant = await requireOwnedVariant(deck.id, variantId, session.user.id)

  // Overridden cards go with it (ON DELETE CASCADE).
  await db.delete(deckVariants).where(eq(deckVariants.id, variant.id))

  return { id: variant.id, deleted: true }
})
