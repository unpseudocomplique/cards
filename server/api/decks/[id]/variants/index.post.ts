import { z } from 'zod'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, deckVariants } from '~~/server/utils/db'
import { serializeVariant } from '~~/server/utils/deckVariants'
import { parseBody } from '~~/server/utils/validation'
import { VARIANT_NAME_MAX } from '~~/shared/utils/deckVariants'

const createVariantSchema = z.object({
  name: z.string().trim().min(1, 'Donnez un nom à la variante').max(VARIANT_NAME_MAX, 'Nom trop long')
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const { name } = parseBody(createVariantSchema, await readBody(event))

  const [variant] = await db
    .insert(deckVariants)
    .values({ deckId: deck.id, userId: session.user.id, name })
    .returning()

  return { ...serializeVariant(variant!), cards: [] }
})
