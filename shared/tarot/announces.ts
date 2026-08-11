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
