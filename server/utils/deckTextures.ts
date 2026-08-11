import { buildTarot78Deck, isTrump } from '~~/shared/tarot'
import type { CardId } from '~~/shared/tarot'
import type { DeckTextureManifest } from '~~/shared/tarot/deckTextures'

export type { DeckTextureManifest } from '~~/shared/tarot/deckTextures'

export function aspectRatioForCard(cardCode: string): '3:4' | '9:16' {
  return isTrump(cardCode as CardId) ? '9:16' : '3:4'
}

export function buildDeckTextureManifest(input: {
  deckId: string
  backUrl: string | null
  cards: Array<{ cardCode: string, finalImageUrl: string | null, aspectRatio?: '3:4' | '9:16' }>
}): DeckTextureManifest {
  const byCode = new Map(input.cards.map(card => [card.cardCode, card]))
  const cards = buildTarot78Deck().map((cardCode) => {
    const row = byCode.get(cardCode)
    return {
      cardCode,
      faceUrl: row?.finalImageUrl ?? null,
      aspectRatio: row?.aspectRatio ?? aspectRatioForCard(cardCode),
    }
  })

  return {
    deckId: input.deckId,
    backUrl: input.backUrl,
    cards,
  }
}
