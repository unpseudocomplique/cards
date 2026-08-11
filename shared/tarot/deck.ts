import type { CardId, CardSuit } from './types'
import { TAROT_RANKS, TAROT_SUITS } from './types'

const OUDLERS = new Set<CardId>(['trump-21', 'trump-1', 'excuse'] as CardId[])

export function buildTarot78Deck(): CardId[] {
  const suitCards = TAROT_SUITS.flatMap(suit =>
    TAROT_RANKS.map(rank => `${suit}-${rank}` as CardId)
  )
  const trumps = Array.from({ length: 21 }, (_, i) => `trump-${i + 1}` as CardId)
  return [...suitCards, ...trumps, 'excuse' as CardId]
}

export function isOudler(card: CardId): boolean {
  return OUDLERS.has(card)
}

export function isTrump(card: CardId): boolean {
  return card === 'excuse' || card.startsWith('trump-')
}

export function cardSuit(card: CardId): CardSuit | null {
  if (card === 'excuse' || card.startsWith('trump-')) {
    return 'trumps'
  }
  const suit = TAROT_SUITS.find(s => card.startsWith(`${s}-`))
  return suit ?? null
}

export function cardPoints(card: CardId): number {
  if (isOudler(card)) {
    return 4.5
  }
  if (card.endsWith('-k')) {
    return 4.5
  }
  if (card.endsWith('-q')) {
    return 3.5
  }
  if (card.endsWith('-c')) {
    return 2.5
  }
  if (card.endsWith('-j')) {
    return 1.5
  }
  return 0.5
}
