import type { Contract } from './bid'
import { cardPoints, isOudler } from './deck'
import type { CardId } from './types'

const CONTRACT_MULT: Record<Contract, number> = {
  prise: 1,
  garde: 2,
  garde_sans: 4,
  garde_contre: 6,
}

const REQUIRED: Record<0 | 1 | 2 | 3, number> = {
  0: 56,
  1: 51,
  2: 41,
  3: 36,
}

export function requiredPoints(oudlerCount: 0 | 1 | 2 | 3): number {
  return REQUIRED[oudlerCount]
}

/**
 * Exact card points (half points kept). Counting by pairs gives the same total;
 * a leftover half point is settled by `roundTakerPoints`.
 */
export function countCardPoints(cards: CardId[]): number {
  return cards.reduce((total, card) => total + cardPoints(card), 0)
}

/** FFT: a half point always goes to the camp that wins the deal. */
export function roundTakerPoints(rawPoints: number, required: number): number {
  return rawPoints >= required ? Math.ceil(rawPoints) : Math.floor(rawPoints)
}

export type DealScoreInput = {
  playerCount: 3 | 4 | 5
  contract: Contract
  takerSeat: number
  partnerSeat?: number
  takerCards: CardId[]
  /**
   * Excuse exchange: -0.5 when the attack kept its Excuse and owes a low card,
   * +0.5 when the defence does.
   */
  takerPointsAdjust?: number
  /** Reserved for future validation; scoring uses takerCards only. */
  defenseCards: CardId[]
  poigneePrime?: number
  petitAuBoutCamp?: 'attack' | 'defense'
  chelem?: 'announced_made' | 'unannounced_made' | 'announced_failed' | 'defense'
}

function oudlerCountIn(cards: CardId[]): 0 | 1 | 2 | 3 {
  const n = cards.filter(isOudler).length
  return Math.min(n, 3) as 0 | 1 | 2 | 3
}

function defenderSeats(
  playerCount: 3 | 4 | 5,
  takerSeat: number,
  partnerSeat?: number,
): number[] {
  const seats: number[] = []
  for (let seat = 0; seat < playerCount; seat++) {
    if (seat === takerSeat) {
      continue
    }
    if (playerCount === 5 && partnerSeat !== undefined && seat === partnerSeat) {
      continue
    }
    seats.push(seat)
  }
  return seats
}

function chelemPart(chelem: DealScoreInput['chelem']): number {
  switch (chelem) {
    case 'announced_made':
      return 400
    case 'unannounced_made':
      return 200
    case 'announced_failed':
      return -200
    default:
      return 0
  }
}

export function computeDealScore(input: DealScoreInput): Record<number, number> {
  const {
    playerCount,
    contract,
    takerSeat,
    partnerSeat,
    takerCards,
    takerPointsAdjust,
    poigneePrime,
    petitAuBoutCamp,
    chelem,
  } = input

  const mult = CONTRACT_MULT[contract]
  const oudlers = oudlerCountIn(takerCards)
  const required = requiredPoints(oudlers)
  const takerPoints = roundTakerPoints(countCardPoints(takerCards) + (takerPointsAdjust ?? 0), required)
  const success = takerPoints >= required
  const diff = takerPoints - required

  const sign = success ? 1 : -1
  const contractPart = sign * (25 + Math.abs(diff)) * mult

  const poigneePart = poigneePrime
    ? (success ? poigneePrime : -poigneePrime)
    : 0

  let petitPart = 0
  if (petitAuBoutCamp === 'attack') {
    petitPart = 10 * mult
  } else if (petitAuBoutCamp === 'defense') {
    petitPart = -10 * mult
  }

  const S = contractPart + poigneePart + petitPart + chelemPart(chelem)

  const defenders = defenderSeats(playerCount, takerSeat, partnerSeat)

  const deltas: Record<number, number> = {}
  for (let seat = 0; seat < playerCount; seat++) {
    deltas[seat] = 0
  }

  if (playerCount === 5 && partnerSeat !== undefined) {
    deltas[takerSeat] = 2 * S
    deltas[partnerSeat] = S
    for (const seat of defenders) {
      deltas[seat] = -S
    }
  } else {
    deltas[takerSeat] = defenders.length * S
    for (const seat of defenders) {
      deltas[seat] = -S
    }
  }

  if (chelem === 'defense') {
    const bonus = 200
    for (const seat of defenders) {
      deltas[seat] += bonus
    }
    if (playerCount === 5 && partnerSeat !== undefined) {
      const total = bonus * defenders.length
      deltas[takerSeat] -= (2 * total) / 3
      deltas[partnerSeat] -= total / 3
    } else {
      deltas[takerSeat] -= bonus * defenders.length
    }
  }

  return deltas
}
