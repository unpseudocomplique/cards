import type { CardId, GameState, PlayerCount, PublicGameView } from './types'

type CampState = {
  playerCount: PlayerCount
  bid: { seat: number } | null
  partnerSeat?: number
}

export function attackSeats(state: CampState): number[] {
  const taker = state.bid?.seat
  if (taker === undefined) {
    return []
  }
  if (state.playerCount === 5 && state.partnerSeat !== undefined) {
    return [taker, state.partnerSeat]
  }
  return [taker]
}

export function isAttackSeat(state: CampState, seat: number): boolean {
  return attackSeats(state).includes(seat)
}

export function sameCamp(state: CampState, seatA: number, seatB: number): boolean {
  if (!state.bid) {
    return seatA === seatB
  }
  return isAttackSeat(state, seatA) === isAttackSeat(state, seatB)
}

export function isBout(card: CardId): boolean {
  return card === 'trump-21' || card === 'trump-1' || card === 'excuse'
}

export function boutLabel(card: CardId): string | null {
  if (card === 'trump-21') {
    return 'Le 21'
  }
  if (card === 'trump-1') {
    return 'Le Petit'
  }
  if (card === 'excuse') {
    return "L'Excuse"
  }
  return null
}

export function findPetitOwner(trick: Array<{ seat: number, card: CardId }>): number | null {
  const entry = trick.find(item => item.card === 'trump-1')
  return entry?.seat ?? null
}

/** Petit captured by the opposite camp (classic “petit volé”). */
export function isPetitStolen(
  state: CampState | PublicGameView | Pick<GameState, 'playerCount' | 'bid' | 'partnerSeat'>,
  trick: Array<{ seat: number, card: CardId }>,
  winnerSeat: number,
): { stolen: true, victimSeat: number, thiefSeat: number } | { stolen: false } {
  const victimSeat = findPetitOwner(trick)
  if (victimSeat === null) {
    return { stolen: false }
  }
  if (sameCamp(state, victimSeat, winnerSeat)) {
    return { stolen: false }
  }
  return { stolen: true, victimSeat, thiefSeat: winnerSeat }
}
