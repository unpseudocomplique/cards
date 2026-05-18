import { z } from 'zod'
import { getCardCatalog } from '~~/server/utils/cardCatalog'
import { db, deckCards, decks } from '~~/server/utils/db'

const createDeckSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['classic52', 'tarot56', 'tarot78']),
  allowPhotoReuse: z.boolean().default(true),
  visualStyle: z.string().min(3).max(160).default('illustration royale contemporaine')
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const body = await readBody(event)
  const result = createDeckSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      status: 400,
      message: 'Données invalides',
      data: result.error.flatten()
    })
  }

  const input = result.data
  const catalog = getCardCatalog(input.type)

  const deck = await db.transaction(async (tx) => {
    const [createdDeck] = await tx
      .insert(decks)
      .values({
        userId: session.user.id,
        title: input.title,
        description: input.description,
        type: input.type,
        cardCount: catalog.length,
        settings: {
          allowPhotoReuse: input.allowPhotoReuse,
          visualStyle: input.visualStyle
        }
      })
      .returning()

    if (!createdDeck) {
      throw new Error('Deck creation failed')
    }

    await tx.insert(deckCards).values(catalog.map(card => ({
      deckId: createdDeck.id,
      userId: session.user.id,
      cardCode: card.cardCode,
      metadata: {
        label: card.label,
        shortLabel: card.shortLabel,
        suit: card.suit,
        rank: card.rank,
        role: card.role,
        sortOrder: card.sortOrder,
        aspectRatio: card.aspectRatio,
        promptHint: card.promptHint
      },
      sortOrder: card.sortOrder
    })))

    return createdDeck
  })

  return deck
})
