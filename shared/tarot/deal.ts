import { buildTarot78Deck } from './deck'
import type { CardId, DealResult, PlayerCount, SeatId } from './types'

interface DealConfig {
  handSize: number
  chienSize: number
  packetSize: number
  rounds: number
  chienRounds: number[]
}

const DEAL_CONFIG: Record<PlayerCount, DealConfig> = {
  3: { handSize: 24, chienSize: 6, packetSize: 4, rounds: 6, chienRounds: [0, 1, 2, 3, 4, 5] },
  4: { handSize: 18, chienSize: 6, packetSize: 3, rounds: 6, chienRounds: [0, 1, 2, 3, 4, 5] },
  5: { handSize: 15, chienSize: 3, packetSize: 3, rounds: 5, chienRounds: [0, 1, 2] }
}

export function shuffleDeck(deck: CardId[], rng: () => number): CardId[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  return shuffled
}

function dealPacket(
  deck: CardId[],
  deckIndex: number,
  hand: CardId[],
  packetSize: number
): number {
  for (let i = 0; i < packetSize; i++) {
    hand.push(deck[deckIndex]!)
    deckIndex++
  }
  return deckIndex
}

function dealChienCard(
  deck: CardId[],
  deckIndex: number,
  chien: CardId[]
): number {
  if (deckIndex === 0 || deckIndex === 77) {
    throw new Error(`Deck indices 0 and 77 must not go to chien (index ${deckIndex})`)
  }
  chien.push(deck[deckIndex]!)
  return deckIndex + 1
}

function packetDeal(
  deck: CardId[],
  playerCount: PlayerCount,
  config: DealConfig,
  firstSeat: SeatId
): { hands: CardId[][], chien: CardId[] } {
  const hands: CardId[][] = Array.from({ length: playerCount }, () => [])
  const chien: CardId[] = []
  let deckIndex = 0

  for (let round = 0; round < config.rounds; round++) {
    const addChien = config.chienRounds.includes(round)
    const lastRound = round === config.rounds - 1

    for (let turn = 0; turn < playerCount; turn++) {
      const seat = (firstSeat + turn) % playerCount
      if (addChien && lastRound && turn === playerCount - 1) {
        deckIndex = dealChienCard(deck, deckIndex, chien)
      }
      deckIndex = dealPacket(deck, deckIndex, hands[seat]!, config.packetSize)
    }

    if (addChien && !lastRound) {
      deckIndex = dealChienCard(deck, deckIndex, chien)
    }
  }

  return { hands, chien }
}

export function detectPetitSecSeats(hands: CardId[][]): SeatId[] {
  const seats: SeatId[] = []
  for (let seat = 0; seat < hands.length; seat++) {
    const hand = hands[seat]!
    if (hand.includes('excuse' as CardId)) {
      continue
    }
    const trumps = hand.filter(card => card.startsWith('trump-'))
    if (trumps.length === 1 && trumps[0] === 'trump-1') {
      seats.push(seat)
    }
  }
  return seats
}

/**
 * Deal a 78-card pack (index 0 = top card) by packets, the first packet going
 * to `firstSeat` (the dealer's right, i.e. the next seat in play order).
 */
export function dealFromShuffled(playerCount: PlayerCount, shuffled: CardId[], firstSeat: SeatId = 0): DealResult {
  if (shuffled.length !== 78) {
    throw new Error(`A tarot pack has 78 cards (got ${shuffled.length})`)
  }
  const config = DEAL_CONFIG[playerCount]
  const { hands, chien } = packetDeal(shuffled, playerCount, config, firstSeat % playerCount)

  return {
    hands,
    chien,
    petitSecSeats: detectPetitSecSeats(hands)
  }
}

export function dealHands(playerCount: PlayerCount, rng: () => number): DealResult {
  const shuffled = shuffleDeck(buildTarot78Deck(), rng)
  return dealFromShuffled(playerCount, shuffled)
}
