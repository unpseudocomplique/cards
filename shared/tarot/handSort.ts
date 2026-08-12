import { cardSuit } from './deck'
import { trumpValue } from './trick'
import type { CardId } from './types'

/** High → low within a plain suit (Roi … As). */
const SUIT_RANK_HIGH_TO_LOW = ['k', 'q', 'c', 'j', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1'] as const

/** Couleurs left→right in hand (alternating red/black). */
const SUIT_ORDER = ['spades', 'hearts', 'clubs', 'diamonds'] as const

function plainRank(card: CardId): string | null {
  if (card === 'excuse' || card.startsWith('trump-')) {
    return null
  }
  const dash = card.lastIndexOf('-')
  if (dash === -1) {
    return null
  }
  return card.slice(dash + 1)
}

function groupKey(card: CardId): number {
  // 0 = atouts (incl. Excuse at end of that block)
  if (card === 'excuse' || card.startsWith('trump-')) {
    return 0
  }
  const suit = cardSuit(card)
  const index = SUIT_ORDER.indexOf(suit as (typeof SUIT_ORDER)[number])
  return index >= 0 ? index + 1 : 99
}

function compareTrumps(a: CardId, b: CardId): number {
  // Excuse after petit (… 2, 1, Excuse).
  if (a === 'excuse') {
    return 1
  }
  if (b === 'excuse') {
    return -1
  }
  // 21 → 1
  return (trumpValue(b) ?? 0) - (trumpValue(a) ?? 0)
}

function comparePlainSuit(a: CardId, b: CardId): number {
  const rankA = plainRank(a)
  const rankB = plainRank(b)
  if (rankA === null || rankB === null) {
    return 0
  }
  const indexA = SUIT_RANK_HIGH_TO_LOW.indexOf(rankA as (typeof SUIT_RANK_HIGH_TO_LOW)[number])
  const indexB = SUIT_RANK_HIGH_TO_LOW.indexOf(rankB as (typeof SUIT_RANK_HIGH_TO_LOW)[number])
  if (indexA < 0 || indexB < 0) {
    return String(rankA).localeCompare(String(rankB))
  }
  // Lower index = stronger → comes first.
  return indexA - indexB
}

/**
 * FFT hand order:
 * - Atouts 21→1 then Excuse
 * - Then ♠ ♥ ♣ ♦, each Roi→As
 */
export function sortHand(cards: CardId[]): CardId[] {
  return [...cards].sort((a, b) => {
    const group = groupKey(a) - groupKey(b)
    if (group !== 0) {
      return group
    }
    if (groupKey(a) === 0) {
      return compareTrumps(a, b)
    }
    return comparePlainSuit(a, b)
  })
}
