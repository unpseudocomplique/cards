import { cardSuit } from './deck'
import { trickLedSuit, trumpValue } from './trick'
import type { CardId, CardSuit } from './types'

function isExcuse(card: CardId): boolean {
  return card === 'excuse'
}

function isRealTrump(card: CardId): boolean {
  return card.startsWith('trump-')
}

function matchesLedSuit(card: CardId, ledSuit: CardSuit): boolean {
  if (ledSuit === 'trumps') {
    return isRealTrump(card)
  }
  return cardSuit(card) === ledSuit
}

function highestTrumpInTrick(trickCards: { seat: number, card: CardId }[]): CardId | null {
  let highest: CardId | null = null
  for (const { card } of trickCards) {
    if (!isRealTrump(card)) {
      continue
    }
    if (!highest || trumpValue(card)! > trumpValue(highest)!) {
      highest = card
    }
  }
  return highest
}

function trumpPlays(handTrumps: CardId[], trickCards: { seat: number, card: CardId }[]): CardId[] {
  const highest = highestTrumpInTrick(trickCards)
  if (!highest) {
    return handTrumps
  }
  const threshold = trumpValue(highest)!
  const overtrumps = handTrumps.filter(card => trumpValue(card)! > threshold)
  return overtrumps.length > 0 ? overtrumps : handTrumps
}

function withExcuse(moves: CardId[], hand: CardId[]): CardId[] {
  const excuse = hand.find(isExcuse)
  if (excuse && !moves.includes(excuse)) {
    return [...moves, excuse]
  }
  return moves
}

export function legalMoves(
  hand: CardId[],
  trickCards: { seat: number, card: CardId }[],
  ledSuit: ReturnType<typeof cardSuit> | null,
): CardId[] {
  if (trickCards.length === 0) {
    return [...hand]
  }

  if (trickCards.length === 1 && trickCards[0].card === 'excuse') {
    return [...hand]
  }

  const effectiveLedSuit = ledSuit ?? trickLedSuit(trickCards)

  if (trickCards.length >= 2 && effectiveLedSuit === null) {
    throw new Error('legalMoves: cannot determine led suit for trick with 2+ cards')
  }

  if (effectiveLedSuit === null) {
    return [...hand]
  }

  const suitCards = hand.filter(card => matchesLedSuit(card, effectiveLedSuit))
  let obligated: CardId[]

  if (suitCards.length > 0) {
    obligated = effectiveLedSuit === 'trumps' ? trumpPlays(suitCards, trickCards) : suitCards
  }
  else {
    const handTrumps = hand.filter(isRealTrump)
    obligated = handTrumps.length > 0 ? trumpPlays(handTrumps, trickCards) : [...hand]
  }

  return withExcuse(obligated, hand)
}
