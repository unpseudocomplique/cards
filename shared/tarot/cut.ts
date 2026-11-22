import type { CardId, GameState, PlayerCount } from './types'

/**
 * FFT: the cutter must take or leave "plus de 3 cartes", so each packet keeps
 * at least 4 cards.
 */
export const MIN_CUT_PACKET = 4
export const TAROT_PACK_SIZE = 78

/** Valid cut positions: number of cards lifted from the top of the pack. */
export function cutRange(packSize = TAROT_PACK_SIZE): { min: number, max: number } {
  return { min: MIN_CUT_PACKET, max: packSize - MIN_CUT_PACKET }
}

export function isValidCut(at: unknown, packSize = TAROT_PACK_SIZE): at is number {
  const { min, max } = cutRange(packSize)
  return typeof at === 'number' && Number.isInteger(at) && at >= min && at <= max
}

/** Lift the top `at` cards and put them under the rest (index 0 = top card). */
export function cutDeck(deck: CardId[], at: number): CardId[] {
  if (!isValidCut(at, deck.length)) {
    throw new Error(`Invalid cut ${at} for a pack of ${deck.length}`)
  }
  return [...deck.slice(at), ...deck.slice(0, at)]
}

/**
 * FFT: the dealer's left neighbour cuts. Play (and the deal) go to the
 * dealer's right, which is the next seat here, so the left neighbour is the
 * previous seat: the one who plays last.
 */
export function cutterSeat(dealerSeat: number, playerCount: PlayerCount): number {
  return (dealerSeat - 1 + playerCount) % playerCount
}

/**
 * Turn a pile kept in the order cards were laid on it (first card at the
 * bottom) into top-to-bottom order.
 */
function topDown(pile: CardId[]): CardId[] {
  return [...pile].reverse()
}

/**
 * Gather the cards at the end of a played deal the way players do at the
 * table, without shuffling: each camp squares up its pile of tricks (tricks
 * kept as they were won, the écart or the dog at the bottom of its owner's
 * pile), then the defence pile goes on top of the attack pile.
 */
export function gatherPlayedDeal(state: GameState): CardId[] {
  const contract = state.bid?.contract
  const attackBottom = contract === 'garde_sans'
    ? state.chien
    : contract === 'garde_contre' ? [] : state.ecart
  const defenseBottom = contract === 'garde_contre' ? state.chien : []

  const attackPile = [...attackBottom, ...state.pilesAttack]
  const defensePile = [...defenseBottom, ...state.pilesDefense]
  // Cards still in hand (should not happen after a full deal) go on top.
  const leftovers = state.hands.flat()
  return [...leftovers, ...topDown(defensePile), ...topDown(attackPile)]
}

/**
 * Everybody passed: each player puts their hand down as it is and the hands
 * are stacked, with the dog, from the dealer's right round the table.
 */
export function gatherHands(state: GameState): CardId[] {
  const stacks: CardId[] = []
  for (let turn = 1; turn <= state.playerCount; turn++) {
    const seat = (state.dealerSeat + turn) % state.playerCount
    stacks.push(...topDown(state.hands[seat] ?? []))
  }
  return [...stacks, ...state.chien, ...state.ecart]
}
