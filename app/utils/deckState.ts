import type { DeckCard, DeckDetails } from '~/types/deck'

export function replaceDeckCard(cards: DeckCard[], card: DeckCard) {
  return cards.map(existing => existing.id === card.id ? card : existing)
}

export function computeDeckProgress(cards: DeckCard[], cardCount: number) {
  const readyCardCount = cards.filter(card => card.status === 'ready').length
  const isGenerating = cards.some(card => card.status === 'generating' || card.status === 'queued')

  if (readyCardCount === cardCount) {
    return {
      readyCardCount,
      status: 'ready' as const
    }
  }

  return {
    readyCardCount,
    status: isGenerating ? 'generating' as const : 'draft' as const
  }
}

export function patchDeckWithCard(details: DeckDetails, card: DeckCard): DeckDetails {
  const cards = replaceDeckCard(details.cards, card)
  const progress = computeDeckProgress(cards, details.deck.cardCount)

  return {
    ...details,
    deck: {
      ...details.deck,
      ...progress
    },
    cards
  }
}

export function patchDeckSettings(
  details: DeckDetails,
  settings: Partial<DeckDetails['deck']['settings']>
): DeckDetails {
  return {
    ...details,
    deck: {
      ...details.deck,
      settings: {
        ...details.deck.settings,
        ...settings
      }
    }
  }
}
