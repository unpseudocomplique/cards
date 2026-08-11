import { cardSuit } from './deck'
import type { CardId, CardSuit } from './types'

const SUIT_RANK_ORDER = ['k', 'q', 'c', 'j', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1'] as const

function suitRank(card: CardId): string | null {
  const dash = card.lastIndexOf('-')
  if (dash === -1) {
    return null
  }
  return card.slice(dash + 1)
}

function isRealTrump(card: CardId): boolean {
  return card.startsWith('trump-')
}

export function trumpValue(card: CardId): number | null {
  if (!isRealTrump(card)) {
    return null
  }
  return Number.parseInt(card.slice('trump-'.length), 10)
}

export function compareSuitRank(a: CardId, b: CardId): number {
  const rankA = suitRank(a)
  const rankB = suitRank(b)
  if (rankA === null || rankB === null) {
    return 0
  }
  return SUIT_RANK_ORDER.indexOf(rankB as (typeof SUIT_RANK_ORDER)[number])
    - SUIT_RANK_ORDER.indexOf(rankA as (typeof SUIT_RANK_ORDER)[number])
}

function highestTrump(cards: { seat: number, card: CardId }[]): { seat: number, card: CardId } | null {
  let best: { seat: number, card: CardId } | null = null
  for (const entry of cards) {
    if (!isRealTrump(entry.card)) {
      continue
    }
    if (!best || trumpValue(entry.card)! > trumpValue(best.card)!) {
      best = entry
    }
  }
  return best
}

/** Led suit for a trick in progress or at resolution (excuse lead → first non-excuse card). */
export function trickLedSuit(cards: { seat: number, card: CardId }[]): CardSuit | null {
  if (cards.length === 0) {
    return null
  }
  if (cards[0].card === 'excuse') {
    for (let i = 1; i < cards.length; i++) {
      const card = cards[i].card
      if (card === 'excuse') {
        continue
      }
      return cardSuit(card)
    }
    return null
  }
  return cardSuit(cards[0].card)
}

function highestOfLedSuit(
  cards: { seat: number, card: CardId }[],
  ledSuit: 'hearts' | 'diamonds' | 'clubs' | 'spades',
): { seat: number, card: CardId } | null {
  let best: { seat: number, card: CardId } | null = null
  for (const entry of cards) {
    if (entry.card === 'excuse' || isRealTrump(entry.card)) {
      continue
    }
    if (!entry.card.startsWith(`${ledSuit}-`)) {
      continue
    }
    if (!best || compareSuitRank(entry.card, best.card) > 0) {
      best = entry
    }
  }
  return best
}

// Excuse never wins a trick. Chelem last-trick camp change is handled in score/bookkeeping.
export function resolveTrick(cards: { seat: number, card: CardId }[]): { winnerSeat: number } {
  const trumpWinner = highestTrump(cards)
  if (trumpWinner) {
    return { winnerSeat: trumpWinner.seat }
  }

  const ledSuit = trickLedSuit(cards)
  if (!ledSuit || ledSuit === 'trumps') {
    throw new Error('resolveTrick: no winner (trump-led or excuse-only trick)')
  }

  const suitWinner = highestOfLedSuit(cards, ledSuit)
  if (!suitWinner) {
    throw new Error('resolveTrick: no winner')
  }

  return { winnerSeat: suitWinner.seat }
}
