import { BID_RANK, expectedSeat, type Contract } from './bid'
import { isOudler, isTrump } from './deck'
import { validateEcart } from './ecart'
import { KING_IDS } from './announces'
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

/** Rough FFT hand strength used for bot bidding thresholds. */
export function evaluateHandStrength(hand: CardId[]): number {
  const realTrumps = hand.filter(isRealTrump)
  const oudlers = hand.filter(isOudler).length
  const highTrumps = realTrumps.filter(card => (trumpValue(card) ?? 0) >= 14).length
  const kings = hand.filter(card => card.endsWith('-k')).length
  const queens = hand.filter(card => card.endsWith('-q')).length
  return realTrumps.length * 2
    + oudlers * 5
    + highTrumps * 2
    + kings * 2
    + queens
}

function chooseContractForStrength(strength: number, minOvercall: Contract | null): Contract | 'passe' {
  // Conservative FFT-ish thresholds — bots were over-bidding weak-medium hands.
  const thresholds: Array<{ contract: Contract, min: number }> = [
    { contract: 'garde_contre', min: 38 },
    { contract: 'garde_sans', min: 32 },
    { contract: 'garde', min: 26 },
    { contract: 'prise', min: 16 },
  ]

  let bid: Contract | 'passe' = 'passe'
  for (const row of thresholds) {
    if (strength >= row.min) {
      bid = row.contract
      break
    }
  }

  if (bid === 'passe') {
    return 'passe'
  }
  if (minOvercall && BID_RANK[bid] <= BID_RANK[minOvercall]) {
    // Only stretch when the hand already clears the *needed* contract threshold.
    const ladder: Contract[] = ['prise', 'garde', 'garde_sans', 'garde_contre']
    const needed = ladder.find(contract => BID_RANK[contract] > BID_RANK[minOvercall])
    if (!needed) {
      return 'passe'
    }
    const neededMin = thresholds.find(row => row.contract === needed)?.min ?? 99
    if (strength < neededMin) {
      return 'passe'
    }
    return needed
  }
  return bid
}

function chooseBidIntent(state: GameState, seat: number): Intent {
  if (!state.bidState) {
    throw new Error('chooseBotIntent: bidding state missing')
  }
  if (expectedSeat(state.bidState) !== seat) {
    throw new Error(`chooseBotIntent: seat ${seat} is not the expected bidder`)
  }

  const hand = state.hands[seat] ?? []
  const strength = evaluateHandStrength(hand)
  const winner = state.bidState.currentWinner
  const bid = chooseContractForStrength(strength, winner?.contract ?? null)
  return { type: 'bid', bid }
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

function suitOf(card: CardId): string | null {
  if (card === 'excuse' || isRealTrump(card)) {
    return null
  }
  return card.split('-')[0] ?? null
}

function chooseCallKingIntent(state: GameState, seat: number): Intent {
  if (!state.bid || seat !== state.bid.seat) {
    throw new Error('chooseBotIntent: only the taker may call a king')
  }
  const hand = state.hands[seat] ?? []
  const suitCounts = new Map<string, number>()
  for (const card of hand) {
    const suit = suitOf(card)
    if (!suit) {
      continue
    }
    suitCounts.set(suit, (suitCounts.get(suit) ?? 0) + 1)
  }

  const ranked = [...KING_IDS]
    .map(king => {
      const suit = suitOf(king as CardId) ?? ''
      return {
        king: king as CardId,
        inHand: hand.includes(king as CardId),
        length: suitCounts.get(suit) ?? 0,
      }
    })
    .sort((a, b) => {
      if (a.inHand !== b.inHand) {
        return a.inHand ? 1 : -1
      }
      return b.length - a.length
    })

  return { type: 'callKing', king: ranked[0]!.king }
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
  // Lead low non-trumps when possible; otherwise dump the lowest legal card.
  if (state.trick.length === 0) {
    const softLeads = view.legalMoves
      .filter(card => !isRealTrump(card) && card !== 'excuse')
      .sort(compareLowest)
    if (softLeads.length > 0) {
      return { type: 'playCard', card: softLeads[0]! }
    }
  }
  const card = pickLowestCard(view.legalMoves, state.trick)
  return { type: 'playCard', card }
}

export function chooseBotIntent(state: GameState, seat: number): Intent {
  if (
    state.playerCount === 5
    && state.bid
    && !state.calledKing
    && (state.phase === 'DogEcarta' || state.phase === 'ReadyToPlay')
  ) {
    if (seat !== state.bid.seat) {
      throw new Error(`chooseBotIntent: waiting for taker to call a king`)
    }
    return chooseCallKingIntent(state, seat)
  }

  if (state.phase === 'Scoring') {
    return { type: 'continue' }
  }

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
