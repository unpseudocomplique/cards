import { BID_RANK, type Contract } from '../bid'
import { isOudler } from '../deck'
import type { BotLevel, CardId, PlayerCount } from '../types'
import { botSuit, isRealTrump, PLAIN_SUITS, rankOf } from './cards'
import type { Rng } from './rng'

/** Old rough strength used by the easy bots (and kept for compatibility). */
export function evaluateHandStrength(hand: CardId[]): number {
  const realTrumps = hand.filter(isRealTrump)
  const oudlers = hand.filter(isOudler).length
  const highTrumps = realTrumps.filter(card => rankOf(card) >= 14).length
  const kings = hand.filter(card => card.endsWith('-k')).length
  const queens = hand.filter(card => card.endsWith('-q')).length
  return realTrumps.length * 2
    + oudlers * 5
    + highTrumps * 2
    + kings * 2
    + queens
}

/**
 * Classic French point count for a tarot hand (the one taught in clubs):
 * trumps, oudlers (the Petit only counts when it is protected), honours,
 * long suits and voids/singletons.
 */
export function handPoints(hand: CardId[]): number {
  const trumps = hand.filter(isRealTrump)
  const trumpCount = trumps.length
  let total = trumpCount * 5
  for (const trump of trumps) {
    const rank = rankOf(trump)
    if (rank >= 16 && rank <= 20) {
      total += 2
    }
  }
  if (hand.includes('trump-21' as CardId)) {
    total += 10
  }
  if (hand.includes('excuse' as CardId)) {
    total += 8
  }
  if (hand.includes('trump-1' as CardId)) {
    total += trumpCount >= 6 ? 8 : trumpCount === 5 ? 6 : trumpCount === 4 ? 3 : 0
  }
  for (const suit of PLAIN_SUITS) {
    const cards = hand.filter(card => botSuit(card) === suit)
    const has = (rank: string) => cards.includes(`${suit}-${rank}` as CardId)
    if (has('k')) {
      total += 6
    }
    if (has('q')) {
      total += has('k') ? 4 : 2
    }
    if (has('c')) {
      total += has('k') || has('q') ? 2 : 1
    }
    if (has('j')) {
      total += 1
    }
    const length = cards.length
    if (length >= 5) {
      total += length === 5 ? 5 : length === 6 ? 7 : 9
    }
    if (trumpCount >= 4) {
      if (length === 0) {
        total += 6
      } else if (length === 1 && !has('k')) {
        total += 3
      }
    }
  }
  return total
}

const LADDER: Contract[] = ['prise', 'garde', 'garde_sans', 'garde_contre']

/**
 * Points needed for each contract with 4 players (18 cards). A bit above the
 * club table (40 / 56 / 71 / 81): in simulations, prises under 50 points lost
 * most of the time against a defence that plays well.
 */
const BASE_THRESHOLDS: Record<Contract, number> = {
  prise: 49,
  garde: 63,
  garde_sans: 74,
  garde_contre: 84
}

function thresholdFor(contract: Contract, playerCount: PlayerCount): number {
  // 3 players hold 24 cards, 5 players 15 cards and play with a partner.
  const scale = playerCount === 3 ? 1.28 : playerCount === 5 ? 0.82 : 1
  return BASE_THRESHOLDS[contract] * scale
}

const OLD_THRESHOLDS: Array<{ contract: Contract, min: number }> = [
  { contract: 'garde_contre', min: 38 },
  { contract: 'garde_sans', min: 32 },
  { contract: 'garde', min: 26 },
  { contract: 'prise', min: 16 }
]

export function chooseBid(
  hand: CardId[],
  playerCount: PlayerCount,
  level: BotLevel,
  minOvercall: Contract | null,
  rng: Rng
): Contract | 'passe' {
  let wanted: Contract | null = null
  if (level === 'facile') {
    const strength = evaluateHandStrength(hand) + Math.round((rng() - 0.5) * 8)
    wanted = OLD_THRESHOLDS.find(row => strength >= row.min)?.contract ?? null
  } else {
    const noise = level === 'moyen' ? (rng() - 0.5) * 6 : 0
    const value = handPoints(hand) + noise
    for (const contract of [...LADDER].reverse()) {
      if (value >= thresholdFor(contract, playerCount)) {
        wanted = contract
        break
      }
    }
    // Garde sans / contre without at least two oudlers is a gamble.
    const oudlers = hand.filter(isOudler).length
    if (level === 'difficile' && oudlers < 2 && wanted && BID_RANK[wanted] > BID_RANK.garde) {
      wanted = 'garde'
    }
  }

  if (!wanted) {
    return 'passe'
  }
  if (minOvercall && BID_RANK[wanted] <= BID_RANK[minOvercall]) {
    return 'passe'
  }
  return wanted
}
