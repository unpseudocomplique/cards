export type Contract = 'prise' | 'garde' | 'garde_sans' | 'garde_contre'

export const BID_RANK: Record<Contract, number> = {
  prise: 1,
  garde: 2,
  garde_sans: 3,
  garde_contre: 4,
}

export type BidState = {
  playerCount: 3 | 4 | 5
  firstBidderSeat: number
  spoken: Array<{ seat: number; bid: Contract | 'passe' }>
  currentWinner: { seat: number; contract: Contract } | null
}

export type BidOutcome =
  | { type: 'all_pass' }
  | { type: 'won'; seat: number; contract: Contract }

export type BidResult =
  | { ok: true; state: BidState; outcome?: BidOutcome }
  | { ok: false; reason: string }

function seatAtTurn(state: BidState, turnIndex: number): number {
  return (state.firstBidderSeat + turnIndex) % state.playerCount
}

export function createBidState(playerCount: 3 | 4 | 5, firstBidderSeat: number): BidState {
  if (firstBidderSeat < 0 || firstBidderSeat >= playerCount) {
    throw new RangeError(`firstBidderSeat must be 0..${playerCount - 1}`)
  }
  return {
    playerCount,
    firstBidderSeat,
    spoken: [],
    currentWinner: null,
  }
}

export function expectedSeat(state: BidState): number {
  if (state.spoken.length >= state.playerCount) {
    throw new Error('Bidding round is complete')
  }
  return seatAtTurn(state, state.spoken.length)
}

export function applyBid(state: BidState, seat: number, bid: Contract | 'passe'): BidResult {
  if (state.spoken.length >= state.playerCount) {
    return { ok: false, reason: 'Bidding round is already complete' }
  }

  const turnSeat = seatAtTurn(state, state.spoken.length)
  if (seat !== turnSeat) {
    return { ok: false, reason: `Not seat ${seat}'s turn; expected seat ${turnSeat}` }
  }

  if (state.spoken.some(entry => entry.seat === seat)) {
    return { ok: false, reason: `Seat ${seat} has already spoken this round` }
  }

  if (bid !== 'passe') {
    if (state.currentWinner && BID_RANK[bid] <= BID_RANK[state.currentWinner.contract]) {
      return {
        ok: false,
        reason: `Bid ${bid} must strictly overcall current winning bid ${state.currentWinner.contract}`,
      }
    }
  }

  const spoken = [...state.spoken, { seat, bid }]
  const currentWinner =
    bid === 'passe'
      ? state.currentWinner
      : { seat, contract: bid }

  const nextState: BidState = {
    ...state,
    spoken,
    currentWinner,
  }

  if (spoken.length < state.playerCount) {
    return { ok: true, state: nextState }
  }

  if (!currentWinner) {
    return { ok: true, state: nextState, outcome: { type: 'all_pass' } }
  }

  return {
    ok: true,
    state: nextState,
    outcome: {
      type: 'won',
      seat: currentWinner.seat,
      contract: currentWinner.contract,
    },
  }
}
