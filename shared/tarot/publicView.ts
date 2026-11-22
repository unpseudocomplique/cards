import { legalMovesForSeat } from './legalMoves'
import { sortHand } from './handSort'
import { resolveTrick } from './trick'
import type {
  CardId,
  GameState,
  PrivateGameView,
  PublicGameView,
  PublicSeatInfo
} from './types'

function publicSeats(state: GameState): PublicSeatInfo[] {
  return state.seats.map(seat => ({
    seatId: seat.seatId,
    userId: seat.userId,
    name: seat.name,
    connected: seat.connected,
    controlledBy: seat.controlledBy,
    ...(seat.botLevel ? { botLevel: seat.botLevel } : {}),
    ...(seat.picture ? { picture: seat.picture } : {}),
    ...(seat.character ? { character: seat.character } : {})
  }))
}

function previousTrick(state: GameState): PublicGameView['previousTrick'] {
  const cards = state.playedTricks?.at(-1)
  if (!cards?.length) {
    return null
  }
  const index = (state.playedTricks?.length ?? 0) - 1
  const winnerSeat = state.playedTrickWinners?.[index] ?? resolveTrick(cards).winnerSeat
  return { cards: cards.map(entry => ({ ...entry })), winnerSeat }
}

function chienRevealed(state: GameState): CardId[] | null {
  // FFT: prise / garde turn the dog face up for everyone (5 players: after the
  // king call) until the taker discards. Garde sans / contre: nobody sees it.
  if (state.phase !== 'DogEcarta' || !state.dogShown?.length) {
    return null
  }
  return [...state.dogShown]
}

/**
 * 5 players: the called partner stays secret until the called king is played
 * (or the deal is scored). Before that, only the partner knows, from their hand.
 */
function revealedPartnerSeat(state: GameState): number | undefined {
  if (state.partnerSeat === undefined || !state.calledKing) {
    return state.partnerSeat
  }
  if (state.phase === 'Scoring' || state.phase === 'MatchOver') {
    return state.partnerSeat
  }
  const king = state.calledKing
  const played = state.trick.some(entry => entry.card === king)
    || state.pilesAttack.includes(king)
    || state.pilesDefense.includes(king)
  return played ? state.partnerSeat : undefined
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
  return legalMovesForSeat(state, seat)
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
    partnerSeat: revealedPartnerSeat(state),
    calledKing: state.calledKing,
    scores: [...state.scores],
    dealIndex: state.dealIndex,
    pilesAttackCount: state.pilesAttack.length,
    pilesDefenseCount: state.pilesDefense.length,
    tricksWonBySeat: [...(state.tricksWonBySeat ?? Array.from({ length: state.playerCount }, () => 0))],
    pointsWonBySeat: state.pointsWonBySeat ? [...state.pointsWonBySeat] : undefined,
    oudlersWonBySeat: state.oudlersWonBySeat ? [...state.oudlersWonBySeat] : undefined,
    lastDeal: state.lastDeal ? { ...state.lastDeal, deltas: { ...state.lastDeal.deltas } } : undefined,
    dealHistory: state.dealHistory?.map(entry => ({ ...entry, deltas: { ...entry.deltas }, tricksWonBySeat: [...entry.tricksWonBySeat] })),
    scoringHeld: state.scoringHeld,
    autoContinueAt: state.autoContinueAt,
    lastTrick: state.lastTrick ? state.lastTrick.map(entry => ({ ...entry })) : null,
    lastTrickWinnerSeat: state.lastTrickWinnerSeat ?? null,
    previousTrick: previousTrick(state),
    poignees: state.poignees?.map(entry => ({ ...entry, cards: [...entry.cards] })),
    ecartShownTrumps: state.ecartShownTrumps ? [...state.ecartShownTrumps] : undefined,
    chelemAnnounce: state.chelemAnnounce,
    lastDeltas: state.lastDeltas ? { ...state.lastDeltas } : undefined,
    matchShouldEnd: state.matchShouldEnd,
    ...(state.phase === 'Cutting'
      ? {
          deckCount: state.deck?.length ?? 0,
          deckSource: state.deckSource,
          redealReason: state.redealReason
        }
      : {}),
    ...(state.lastCut ? { lastCut: { ...state.lastCut } } : {})
  }
}

export function toPrivateView(state: GameState, seat: number): PrivateGameView {
  const publicView = toPublicView(state)
  const hand = sortHand([...(state.hands[seat] ?? [])])
  return {
    ...publicView,
    seat,
    hand,
    legalMoves: computeLegalMoves(state, seat)
  }
}
