import type { CardId, PlayerCount } from './types'

export const KING_IDS = ['hearts-k', 'diamonds-k', 'clubs-k', 'spades-k'] as const
export type KingId = (typeof KING_IDS)[number]

export function isKingCard(card: CardId): card is KingId {
  return (KING_IDS as readonly string[]).includes(card)
}

/** FFT poignée tiers by table size (simple / double / triple). */
export function poigneeTiers(playerCount: PlayerCount): Array<8 | 10 | 13 | 15 | 18> {
  if (playerCount === 3) {
    return [13, 15, 18]
  }
  if (playerCount === 5) {
    return [8, 10, 13]
  }
  return [10, 13, 15]
}

export function poigneePrimeForTier(
  playerCount: PlayerCount,
  tier: 8 | 10 | 13 | 15 | 18,
): number | null {
  const tiers = poigneeTiers(playerCount)
  const index = tiers.indexOf(tier)
  if (index === -1) {
    return null
  }
  return ([20, 30, 40] as const)[index]!
}

/** Atouts counting for poignée (real trumps + Excuse). */
export function countPoigneeTrumps(hand: CardId[]): number {
  return hand.filter(card => card === 'excuse' || card.startsWith('trump-')).length
}

const HONOUR_RANKS = ['k', 'q', 'c', 'j'] as const
const HONOUR_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const

/**
 * 5 players: a king may always be called (even one's own). With the 4 kings the
 * taker may call a queen, with the 4 kings and 4 queens a cavalier, and with
 * all kings, queens and cavaliers a valet (FFT).
 */
export function callableCards(hand: CardId[]): CardId[] {
  const callable: CardId[] = []
  for (const rank of HONOUR_RANKS) {
    const cards = HONOUR_SUITS.map(suit => `${suit}-${rank}` as CardId)
    callable.push(...cards)
    if (!cards.every(card => hand.includes(card))) {
      break
    }
  }
  return callable
}

/**
 * Trumps shown with a poignée: exactly `tier` cards, real trumps first. The
 * Excuse only fills in when the player has no other trump to show (FFT).
 */
export function poigneeCards(hand: CardId[], tier: number): CardId[] | null {
  const trumps = hand
    .filter(card => card.startsWith('trump-'))
    .sort((a, b) => Number.parseInt(a.slice(6), 10) - Number.parseInt(b.slice(6), 10))
  if (trumps.length >= tier) {
    return trumps.slice(trumps.length - tier)
  }
  if (trumps.length === tier - 1 && hand.includes('excuse' as CardId)) {
    return [...trumps, 'excuse' as CardId]
  }
  return null
}
