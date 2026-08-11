import { BID_RANK, expectedSeat } from './bid'
import { isOudler, isTrump } from './deck'
import { validateEcart } from './ecart'
import { toPrivateView } from './publicView'
import { compareSuitRank, trickLedSuit, trumpValue } from './trick'
import type { CardId, GameState, Intent, PlayerCount } from './types'

function chienSize(playerCount: PlayerCount): 6 | 3 {
  return playerCount === 5 ? 3 : 6
}

function isRealTrump(card: CardId): boolean {
  return card.startsWith('trump-')
}

function isLegalDiscard(card: CardId): boolean {
  return !isTrump(card) && !card.endsWith('-k')
}

function compareLowest(a: CardId, b: CardId): number {
  if (a === 'excuse' && b !== 'excuse') {
    return 1
  }
  if (b === 'excuse' && a !== 'excuse') {
    return -1
  }
  if (isRealTrump(a) && isRealTrump(b)) {
    return trumpValue(a)! - trumpValue(b)!
  }
  if (isRealTrump(a)) {
    return 1
  }
  if (isRealTrump(b)) {
    return -1
  }
  return compareSuitRank(a, b)
}

function matchesLedSuit(card: CardId, ledSuit: ReturnType<typeof trickLedSuit>): boolean {
  if (ledSuit === null) {
    return false
  }
  if (ledSuit === 'trumps') {
    return isRealTrump(card)
  }
  return card.startsWith(`${ledSuit}-`)
}

function pickLowestCard(moves: CardId[], trick: GameState['trick']): CardId {
  const ledSuit = trick.length > 0 ? trickLedSuit(trick) : null
  if (ledSuit) {
    const following = moves.filter(card => matchesLedSuit(card, ledSuit))
    if (following.length > 0) {
      return [...following].sort(compareLowest)[0]!
    }
  }
  return [...moves].sort(compareLowest)[0]!
}

function shouldBidPrise(hand: CardId[]): boolean {
  const realTrumps = hand.filter(isRealTrump)
  const hasOudler = hand.some(isOudler)
  return realTrumps.length >= 4 && hasOudler
}

function chooseBidIntent(state: GameState, seat: number): Intent {
  if (!state.bidState) {
    throw new Error('chooseBotIntent: bidding state missing')
  }
  if (expectedSeat(state.bidState) !== seat) {
    throw new Error(`chooseBotIntent: seat ${seat} is not the expected bidder`)
  }

  const hand = state.hands[seat] ?? []
  if (!shouldBidPrise(hand)) {
    return { type: 'bid', bid: 'passe' }
  }

  const winner = state.bidState.currentWinner
  if (winner && BID_RANK.prise <= BID_RANK[winner.contract]) {
    return { type: 'bid', bid: 'passe' }
  }

  return { type: 'bid', bid: 'prise' }
}

function pickEcartDiscard(hand: CardId[], size: 6 | 3): CardId[] {
  const discard: CardId[] = []
  const legal = hand.filter(isLegalDiscard).sort(compareLowest)
  for (const card of legal) {
    if (discard.length >= size) {
      break
    }
    discard.push(card)
  }

  if (discard.length < size) {
    const showableTrumps = hand
      .filter(card => isRealTrump(card) && !isOudler(card))
      .sort((a, b) => trumpValue(a)! - trumpValue(b)!)
    for (const card of showableTrumps) {
      if (discard.length >= size) {
        break
      }
      discard.push(card)
    }
  }

  const validation = validateEcart(hand, discard, size)
  if (!validation.ok) {
    throw new Error(`chooseBotIntent: failed to build legal ecart (${validation.reason})`)
  }

  return discard
}

function chooseDiscardIntent(state: GameState, seat: number): Intent {
  if (!state.bid || seat !== state.bid.seat) {
    throw new Error('chooseBotIntent: only the taker may discard')
  }

  const hand = state.hands[seat] ?? []
  const cards = pickEcartDiscard(hand, chienSize(state.playerCount))
  return { type: 'discard', cards }
}

function choosePlayIntent(state: GameState, seat: number): Intent {
  const view = toPrivateView(state, seat)
  if (view.legalMoves.length === 0) {
    throw new Error('chooseBotIntent: no legal moves')
  }
  const card = pickLowestCard(view.legalMoves, state.trick)
  return { type: 'playCard', card }
}

export function chooseBotIntent(state: GameState, seat: number): Intent {
  if (state.currentSeat !== seat) {
    throw new Error(`chooseBotIntent: not seat ${seat}'s turn`)
  }

  switch (state.phase) {
    case 'Bidding':
      return chooseBidIntent(state, seat)
    case 'DogEcarta':
      return chooseDiscardIntent(state, seat)
    case 'Trick':
    case 'ReadyToPlay':
      return choosePlayIntent(state, seat)
    default:
      throw new Error(`chooseBotIntent: unsupported phase ${state.phase}`)
  }
}
