import { legalMoves } from './legalMoves'
import { sortHand } from './handSort'
import { trickLedSuit } from './trick'
import type {
  CardId,
  GameState,
  PrivateGameView,
  PublicGameView,
  PublicSeatInfo,
} from './types'

function publicSeats(state: GameState): PublicSeatInfo[] {
  return state.seats.map(seat => ({
    seatId: seat.seatId,
    userId: seat.userId,
    name: seat.name,
    connected: seat.connected,
    controlledBy: seat.controlledBy,
  }))
}

function chienRevealed(state: GameState): CardId[] | null {
  // Show the dog only before the first card (ReadyToPlay). For garde_sans/contre the
  // cards stay in state.chien until scoring — they must not remain on screen during Trick.
  if (state.phase !== 'ReadyToPlay') {
    return null
  }
  if (state.bid?.contract !== 'garde_sans' && state.bid?.contract !== 'garde_contre') {
    return null
  }
  return state.chien.length > 0 ? state.chien : null
}

function computeLegalMoves(state: GameState, seat: number): CardId[] {
  if (state.phase !== 'Trick' && state.phase !== 'ReadyToPlay') {
    return []
  }
  if (state.currentSeat !== seat) {
    return []
  }
  const hand = state.hands[seat]
  if (!hand || hand.length === 0) {
    return []
  }
  const ledSuit = state.trick.length > 0 ? trickLedSuit(state.trick) : null
  return legalMoves(hand, state.trick, ledSuit)
}

export function toPublicView(state: GameState): PublicGameView {
  return {
    phase: state.phase,
    version: state.version,
    playerCount: state.playerCount,
    endMode: state.endMode,
    endValue: state.endValue,
    code: state.code,
    deckId: state.deckId,
    dealerSeat: state.dealerSeat,
    currentSeat: state.currentSeat,
    seats: publicSeats(state),
    handCounts: state.hands.map(hand => hand.length),
    trick: state.trick.map(entry => ({ ...entry })),
    chienRevealed: chienRevealed(state),
    ecartCount: state.ecart.length,
    bid: state.bid ? { ...state.bid } : null,
    bidSpoken: state.bidSpoken.map(entry => ({ ...entry })),
    partnerSeat: state.partnerSeat,
    calledKing: state.calledKing,
    scores: [...state.scores],
    dealIndex: state.dealIndex,
    pilesAttackCount: state.pilesAttack.length,
    pilesDefenseCount: state.pilesDefense.length,
    tricksWonBySeat: [...(state.tricksWonBySeat ?? Array.from({ length: state.playerCount }, () => 0))],
    lastTrick: state.lastTrick ? state.lastTrick.map(entry => ({ ...entry })) : null,
    lastTrickWinnerSeat: state.lastTrickWinnerSeat ?? null,
    poigneeShown: state.poigneeShown,
    chelemAnnounce: state.chelemAnnounce,
    lastDeltas: state.lastDeltas ? { ...state.lastDeltas } : undefined,
    matchShouldEnd: state.matchShouldEnd,
  }
}

export function toPrivateView(state: GameState, seat: number): PrivateGameView {
  const publicView = toPublicView(state)
  const hand = sortHand([...(state.hands[seat] ?? [])])
  return {
    ...publicView,
    seat,
    hand,
    legalMoves: computeLegalMoves(state, seat),
  }
}
