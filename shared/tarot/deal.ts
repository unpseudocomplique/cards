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
  5: { handSize: 15, chienSize: 3, packetSize: 3, rounds: 5, chienRounds: [0, 1, 2] },
}

function fisherYatesShuffle(deck: CardId[], rng: () => number): CardId[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function dealPacket(
  deck: CardId[],
  deckIndex: number,
  hand: CardId[],
  packetSize: number,
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
  chien: CardId[],
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
): { hands: CardId[][]; chien: CardId[] } {
  const hands: CardId[][] = Array.from({ length: playerCount }, () => [])
  const chien: CardId[] = []
  let deckIndex = 0

  for (let round = 0; round < config.rounds; round++) {
    const addChien = config.chienRounds.includes(round)
    const lastRound = round === config.rounds - 1

    for (let seat = 0; seat < playerCount; seat++) {
      if (addChien && lastRound && seat === playerCount - 1) {
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

function detectPetitSecSeats(hands: CardId[][]): SeatId[] {
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

export function dealHands(playerCount: PlayerCount, rng: () => number): DealResult {
  const config = DEAL_CONFIG[playerCount]
  const deck = fisherYatesShuffle(buildTarot78Deck(), rng)
  const { hands, chien } = packetDeal(deck, playerCount, config)

  return {
    hands,
    chien,
    petitSecSeats: detectPetitSecSeats(hands),
  }
}
