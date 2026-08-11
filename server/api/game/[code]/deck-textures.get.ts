import { and, eq } from 'drizzle-orm'
import { gameStore } from '~~/server/game/GameStore'
import { db, deckCards, decks } from '~~/server/utils/db'
import { buildDeckTextureManifest } from '~~/server/utils/deckTextures'
import type { DeckCardMetadata } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const code = getRouterParam(event, 'code')?.trim()
  if (!code) {
    throw createError({ status: 400, message: 'Code de partie manquant' })
  }

  const state = gameStore.get(code)
  if (!state) {
    throw createError({ status: 404, message: 'Partie introuvable' })
  }

  const seated = state.seats.some(seat => seat.userId === session.user.id)
  if (!seated) {
    throw createError({ status: 403, message: 'Vous devez être assis à cette table' })
  }

  const [deck] = await db
    .select({
      id: decks.id,
      settings: decks.settings,
    })
    .from(decks)
    .where(eq(decks.id, state.deckId))
    .limit(1)

  if (!deck) {
    throw createError({ status: 404, message: 'Deck de la partie introuvable' })
  }

  const rows = await db
    .select({
      cardCode: deckCards.cardCode,
      finalImageUrl: deckCards.finalImageUrl,
      metadata: deckCards.metadata,
    })
    .from(deckCards)
    .where(and(eq(deckCards.deckId, deck.id)))

  return buildDeckTextureManifest({
    deckId: deck.id,
    backUrl: deck.settings.cardBackImageUrl ?? null,
    cards: rows.map(row => ({
      cardCode: row.cardCode,
      finalImageUrl: row.finalImageUrl,
      aspectRatio: (row.metadata as DeckCardMetadata | null)?.aspectRatio,
    })),
  })
})
