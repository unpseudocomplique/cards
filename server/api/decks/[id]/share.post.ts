import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { requireOwnedDeck } from '~~/server/utils/deckAccess'
import { db, decks } from '~~/server/utils/db'

/**
 * Turn on the public read-only link of a deck. Calling it again keeps the
 * current link; pass `{ renew: true }` to replace it (the old link stops working).
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const deckId = getRouterParam(event, 'id')

  if (!deckId) {
    throw createError({ status: 400, message: 'Deck manquant' })
  }

  const deck = await requireOwnedDeck(deckId, session.user.id)
  const body = await readBody<{ renew?: boolean } | null>(event).catch(() => null)

  if (deck.shareToken && !body?.renew) {
    return { shareToken: deck.shareToken }
  }

  // 144 bits of randomness: the link is the only credential.
  const shareToken = randomBytes(18).toString('base64url')

  await db.update(decks).set({ shareToken }).where(eq(decks.id, deck.id))

  return { shareToken }
})
