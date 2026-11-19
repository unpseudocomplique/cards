import { eq } from 'drizzle-orm'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, decks } from '~~/server/utils/db'

/** Turn off the public link: anyone holding it now gets a 404. */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)

  await db.update(decks).set({ shareToken: null }).where(eq(decks.id, deck.id))

  return { shareToken: null }
})
