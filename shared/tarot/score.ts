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

/** Pair method: highest paired with lowest; odd card counts half its value rounded down. */
export function countCardPoints(cards: CardId[]): number {
  const values = cards.map(card => cardPoints(card)).sort((a, b) => b - a)
  let total = 0
  for (let i = 0; i < values.length; i += 2) {
    if (i + 1 < values.length) {
      total += Math.floor(values[i]! + values[i + 1]!)
    } else {
      total += Math.floor(values[i]! / 2)
    }
  }
  return total
}

export type DealScoreInput = {
  playerCount: 3 | 4 | 5
  contract: Contract
  takerSeat: number
  partnerSeat?: number
  takerCards: CardId[]
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

function chelemSigned(
  chelem: DealScoreInput['chelem'],
  defenderCount: number,
): number {
  switch (chelem) {
    case 'announced_made':
      return 400
    case 'unannounced_made':
      return 200
    case 'announced_failed':
      return -200
    case 'defense':
      return -200 * defenderCount
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
    poigneePrime,
    petitAuBoutCamp,
    chelem,
  } = input

  const mult = CONTRACT_MULT[contract]
  const oudlers = oudlerCountIn(takerCards)
  const takerPoints = countCardPoints(takerCards)
  const required = requiredPoints(oudlers)
  const success = takerPoints >= required
  const diff = takerPoints - required

  const base = (25 + Math.abs(diff)) * mult

  const poigneeSigned = poigneePrime
    ? (success ? poigneePrime : -poigneePrime)
    : 0

  let petitSigned = 0
  if (petitAuBoutCamp === 'attack') {
    petitSigned = 10 * mult
  } else if (petitAuBoutCamp === 'defense') {
    petitSigned = -10 * mult
  }

  const defenders = defenderSeats(playerCount, takerSeat, partnerSeat)
  const chelemPrime = chelemSigned(chelem, defenders.length)

  const sign = success ? 1 : -1
  const S = sign * (base + poigneeSigned + petitSigned + chelemPrime)

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
    const attackGain = defenders.length * S
    deltas[takerSeat] = attackGain
    for (const seat of defenders) {
      deltas[seat] = -S
    }
  }

  return deltas
}
