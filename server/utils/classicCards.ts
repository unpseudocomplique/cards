import { and, count, eq } from 'drizzle-orm'
import { renderClassicCardImage } from '~~/server/utils/cardRenderer'
import { db, deckCards, decks, type DeckStyleSettings } from '~~/server/utils/db'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'
import { getCardTheme } from '~~/shared/utils/cardThemes'
import { usesClassicDesign } from '~~/shared/utils/classicCards'
import { resolveDeckCardFormat } from '~~/shared/utils/printSpec'

type ClassicDeck = {
  id: string
  userId: string
  settings: DeckStyleSettings
}

type ClassicCardRow = typeof deckCards.$inferSelect

/** Recount ready faces and set the deck status accordingly. */
export async function updateDeckProgress(deckId: string) {
  const [readyResult] = await db
    .select({ value: count() })
    .from(deckCards)
    .where(and(eq(deckCards.deckId, deckId), eq(deckCards.status, 'ready')))

  const [deck] = await db
    .select({ cardCount: decks.cardCount })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1)

  const readyCardCount = readyResult?.value || 0
  const status = deck && readyCardCount === deck.cardCount ? 'ready' : 'draft'

  await db
    .update(decks)
    .set({ readyCardCount, status, updatedAt: new Date() })
    .where(eq(decks.id, deckId))
}

/** Draw one classic face (ace or numeral), store it and mark the card ready. */
export async function renderAndStoreClassicCard(deck: ClassicDeck, card: ClassicCardRow) {
  const format = resolveDeckCardFormat(deck.settings)
  const theme = getCardTheme(deck.settings.colorTheme)
  const buffer = await renderClassicCardImage(card.metadata, { theme: theme.id, format: format.id })
  const key = generateFileKey(`users/${deck.userId}/decks/${deck.id}/cards/${card.id}`, 'classic.png')
  const url = await uploadFile(buffer, key, 'image/png')
  const { foregroundImageUrl: _foreground, ...metadata } = card.metadata

  const [updated] = await db
    .update(deckCards)
    .set({
      status: 'ready',
      rawImageKey: null,
      rawImageUrl: null,
      finalImageKey: key,
      finalImageUrl: url,
      metadata: { ...metadata, format: format.id, design: 'classic', theme: theme.id },
      errorMessage: null,
      updatedAt: new Date()
    })
    .where(eq(deckCards.id, card.id))
    .returning()

  return updated!
}

/**
 * Bring every ace and numeral of the deck in line with its pip card style:
 * - classic: draw the missing or stale faces (wrong theme, wrong format, AI image);
 * - illustrated: classic faces go back to "to generate".
 * Drawing is local and free, so it runs right away (deck creation, theme or
 * format change, style switch).
 */
export async function syncClassicCards(deck: ClassicDeck) {
  const cards = await db
    .select()
    .from(deckCards)
    .where(eq(deckCards.deckId, deck.id))

  const format = resolveDeckCardFormat(deck.settings)
  const theme = getCardTheme(deck.settings.colorTheme)
  let changed = 0

  for (const card of cards) {
    const classic = usesClassicDesign(card.metadata.role, deck.settings)
    const isClassicFace = card.metadata.design === 'classic'

    if (classic) {
      const upToDate = isClassicFace
        && card.status === 'ready'
        && card.metadata.theme === theme.id
        && card.metadata.format === format.id

      if (!upToDate && card.status !== 'generating') {
        await renderAndStoreClassicCard(deck, card)
        changed += 1
      }
    } else if (isClassicFace) {
      changed += 1
    }
  }

  const toReset = cards.filter(card => card.metadata.design === 'classic' && !usesClassicDesign(card.metadata.role, deck.settings))

  if (toReset.length) {
    await db.transaction(async (tx) => {
      for (const card of toReset) {
        const { design: _design, theme: _theme, ...metadata } = card.metadata
        await tx
          .update(deckCards)
          .set({ status: 'pending', finalImageKey: null, finalImageUrl: null, metadata, updatedAt: new Date() })
          .where(eq(deckCards.id, card.id))
      }
    })
  }

  if (changed) {
    await updateDeckProgress(deck.id)
  }

  return changed
}
