import { cardPoints } from '../deck'
import type { CardId } from '../types'

export type PlainSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type BotSuit = PlainSuit | 'trumps'

export const PLAIN_SUITS: PlainSuit[] = ['hearts', 'diamonds', 'clubs', 'spades']
export const ALL_SUITS: BotSuit[] = [...PLAIN_SUITS, 'trumps']

const RANK_VALUE: Record<string, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, j: 11, c: 12, q: 13, k: 14
}

export const EXCUSE = 'excuse' as CardId
export const PETIT = 'trump-1' as CardId
export const VINGT_ET_UN = 'trump-21' as CardId

export function isExcuse(card: CardId): boolean {
  return card === 'excuse'
}

export function isRealTrump(card: CardId): boolean {
  return card.startsWith('trump-')
}

/** Suit of a card for play purposes; the Excuse has none. */
export function botSuit(card: CardId): BotSuit | null {
  if (card === 'excuse') {
    return null
  }
  if (isRealTrump(card)) {
    return 'trumps'
  }
  return card.slice(0, card.indexOf('-')) as PlainSuit
}

/** 1..14 for plain suits (king = 14), 1..21 for trumps, 0 for the Excuse. */
export function rankOf(card: CardId): number {
  if (card === 'excuse') {
    return 0
  }
  if (isRealTrump(card)) {
    return Number.parseInt(card.slice(6), 10)
  }
  return RANK_VALUE[card.slice(card.indexOf('-') + 1)] ?? 0
}

export function points(card: CardId): number {
  return cardPoints(card)
}

/** All cards of a suit from the top down. */
export function suitCardsDesc(suit: BotSuit): CardId[] {
  if (suit === 'trumps') {
    return Array.from({ length: 21 }, (_, i) => `trump-${21 - i}` as CardId)
  }
  const ranks = ['k', 'q', 'c', 'j', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1']
  return ranks.map(rank => `${suit}-${rank}` as CardId)
}

/** Does `a` beat `b` in a trick whose led suit is `led`? (`b` is the current best.) */
export function beats(a: CardId, b: CardId, led: BotSuit | null): boolean {
  if (a === 'excuse') {
    return false
  }
  if (b === 'excuse') {
    return true
  }
  const sa = botSuit(a)
  const sb = botSuit(b)
  if (sa === 'trumps' && sb !== 'trumps') {
    return true
  }
  if (sa !== 'trumps' && sb === 'trumps') {
    return false
  }
  if (sa === sb) {
    return rankOf(a) > rankOf(b)
  }
  // Different plain suits: only the led suit can win.
  return sa === led && sb !== led
}

/** Winning entry of a (partial) trick. */
export function currentWinner(trick: Array<{ seat: number, card: CardId }>): { seat: number, card: CardId } | null {
  let best: { seat: number, card: CardId } | null = null
  const led = ledSuitOf(trick)
  for (const entry of trick) {
    if (entry.card === 'excuse') {
      continue
    }
    if (!best || beats(entry.card, best.card, led)) {
      best = entry
    }
  }
  return best
}

export function ledSuitOf(trick: Array<{ seat: number, card: CardId }>): BotSuit | null {
  for (const entry of trick) {
    if (entry.card !== 'excuse') {
      return botSuit(entry.card)
    }
  }
  return null
}
