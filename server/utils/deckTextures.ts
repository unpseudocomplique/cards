import { buildTarot78Deck } from '~~/shared/tarot'
import { DECK_CARD_ASPECT_RATIO } from '~~/shared/utils/printSpec'
import type { DeckTextureManifest } from '~~/shared/tarot/deckTextures'

export type { DeckTextureManifest } from '~~/shared/tarot/deckTextures'

/** Every card of a deck shares one format (and one back). */
export function aspectRatioForCard(_cardCode: string): '3:4' | '9:16' {
  return DECK_CARD_ASPECT_RATIO
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
      aspectRatio: aspectRatioForCard(cardCode),
    }
  })

  return {
    deckId: input.deckId,
    backUrl: input.backUrl,
    cards,
  }
}
