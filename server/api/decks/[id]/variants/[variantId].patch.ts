import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { requireOwnedVariant } from '~~/server/utils/deckVariants'
import { db, deckVariants } from '~~/server/utils/db'
import { parseBody } from '~~/server/utils/validation'
import { VARIANT_NAME_MAX } from '~~/shared/utils/deckVariants'

const renameVariantSchema = z.object({
  name: z.string().trim().min(1, 'Donnez un nom à la variante').max(VARIANT_NAME_MAX, 'Nom trop long')
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')
  const variantId = getRouterParam(event, 'variantId')

  if (!deckId || !variantId) {
    throw createError({ status: 400, message: 'Variante manquante' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const variant = await requireOwnedVariant(deck.id, variantId, session.user.id)
  const { name } = parseBody(renameVariantSchema, await readBody(event))

  await db
    .update(deckVariants)
    .set({ name, updatedAt: new Date() })
    .where(eq(deckVariants.id, variant.id))

  return { id: variant.id, name }
})
