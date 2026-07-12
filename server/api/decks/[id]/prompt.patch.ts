import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { mergeRolePrompts, mergeSuitPrompts } from '~~/shared/utils/cardPromptPresets'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, decks } from '~~/server/utils/db'

const promptTextSchema = z.string().trim().min(3).max(1600)
const rolePromptsSchema = z.object({
  number: promptTextSchema.optional(),
  ace: promptTextSchema.optional(),
  jack: promptTextSchema.optional(),
  knight: promptTextSchema.optional(),
  queen: promptTextSchema.optional(),
  king: promptTextSchema.optional(),
  trump: promptTextSchema.optional(),
  excuse: promptTextSchema.optional()
}).strict()
const suitPromptsSchema = z.object({
  hearts: promptTextSchema.optional(),
  diamonds: promptTextSchema.optional(),
  clubs: promptTextSchema.optional(),
  spades: promptTextSchema.optional(),
  trumps: promptTextSchema.optional()
}).strict()

const updateDeckPromptSchema = z.object({
  visualStyle: promptTextSchema.optional(),
  rolePrompts: rolePromptsSchema.optional(),
  suitPrompts: suitPromptsSchema.optional(),
  cardBackPrompt: z.string().trim().max(1600).nullable().optional()
}).refine(input => input.visualStyle || input.rolePrompts || input.suitPrompts || input.cardBackPrompt !== undefined, {
  message: 'Aucun prompt à sauvegarder'
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const body = await readBody(event)
  const result = updateDeckPromptSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      status: 400,
      message: 'Prompt invalide',
      data: result.error.flatten()
    })
  }

  const [updatedDeck] = await db
    .update(decks)
    .set({
      settings: {
        ...deck.settings,
        visualStyle: result.data.visualStyle || deck.settings.visualStyle,
        rolePrompts: result.data.rolePrompts
          ? mergeRolePrompts({ ...deck.settings.rolePrompts, ...result.data.rolePrompts })
          : mergeRolePrompts(deck.settings.rolePrompts),
        suitPrompts: result.data.suitPrompts
          ? mergeSuitPrompts({ ...deck.settings.suitPrompts, ...result.data.suitPrompts })
          : mergeSuitPrompts(deck.settings.suitPrompts),
        cardBackPrompt: result.data.cardBackPrompt === undefined
          ? deck.settings.cardBackPrompt
          : (result.data.cardBackPrompt || undefined)
      },
      updatedAt: new Date()
    })
    .where(eq(decks.id, deck.id))
    .returning()

  return updatedDeck
})
