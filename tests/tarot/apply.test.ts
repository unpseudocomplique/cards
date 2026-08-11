import { describe, expect, it } from 'vitest'
import { apply } from '../../shared/tarot/apply'
import { createBidState, expectedSeat } from '../../shared/tarot/bid'
import { createEmptyGame } from '../../shared/tarot/createGame'
import { toPrivateView, toPublicView } from '../../shared/tarot/publicView'
import type { CardId, GameState } from '../../shared/tarot/types'

const c = (id: string) => id as CardId

const HOST = 'user:host'

function addBots(state: GameState, count: number): GameState {
  let current = state
  for (let i = 0; i < count; i++) {
    const result = apply(current, { type: 'addBot' }, { userId: HOST })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return current
    }
    current = result.state
  }
  return current
}

function actorForSeat(state: GameState, seat: number) {
  const userId = state.seats[seat]?.userId
  if (!userId) {
    throw new Error(`Seat ${seat} has no user`)
  }
  return { userId, seat }
}

describe('createEmptyGame + lobby flow', () => {
  it('4p addBot×3 then start enters Bidding with dealt hands', () => {
    let state = createEmptyGame({
      hostUserId: HOST,
      playerCount: 4,
      endMode: 'threshold',
      endValue: 1000,
    })

    state = addBots(state, 3)

    const start = apply(state, { type: 'start' }, { userId: HOST })
    expect(start.ok).toBe(true)
    if (!start.ok) {
      return
    }

    expect(start.state.phase).toBe('Bidding')
    expect(start.state.dealIndex).toBe(1)
    expect(start.state.hands.every(hand => hand.length === 18)).toBe(true)
    expect(start.state.chien).toHaveLength(6)
    expect(start.state.bidState).not.toBeNull()
    expect(start.state.currentSeat).toBe(expectedSeat(start.state.bidState!))
  })
})

describe('all-pass redeal', () => {
  it('returns to Bidding with a fresh deal when everyone passes', () => {
    let state = addBots(
      createEmptyGame({
        hostUserId: HOST,
        playerCount: 4,
        endMode: 'threshold',
        endValue: 1000,
      }),
      3,
    )

    const started = apply(state, { type: 'start' }, { userId: HOST })
    expect(started.ok).toBe(true)
    if (!started.ok) {
      return
    }
    state = started.state

    const beforeHands = state.hands.map(hand => [...hand])
    const beforeDealer = state.dealerSeat
    const beforeDealIndex = state.dealIndex

    for (let i = 0; i < 4; i++) {
      const seat = state.currentSeat
      const bid = apply(state, { type: 'bid', bid: 'passe' }, actorForSeat(state, seat))
      expect(bid.ok).toBe(true)
      if (!bid.ok) {
        return
      }
      state = bid.state
    }

    expect(state.phase).toBe('Bidding')
    expect(state.dealerSeat).toBe((beforeDealer + 1) % 4)
    expect(state.dealIndex).toBe(beforeDealIndex)
    expect(state.hands).not.toEqual(beforeHands)
    expect(state.bidState).not.toBeNull()
  })
})

describe('playCard legality', () => {
  function midTrickState(overrides: Partial<GameState> = {}): GameState {
    return {
      ...createEmptyGame({
        hostUserId: HOST,
        playerCount: 4,
        endMode: 'threshold',
        endValue: 1000,
      }),
      phase: 'Trick',
      version: 1,
      dealerSeat: 0,
      currentSeat: 1,
      bid: { seat: 0, contract: 'garde_sans' },
      bidState: null,
      bidSpoken: [],
      chien: [],
      ecart: [],
      pilesAttack: [],
      pilesDefense: [],
      dealIndex: 1,
      rngCounter: 1,
      seats: [
        { seatId: 0, userId: 'user:0', name: 'P0', connected: true, controlledBy: 'human' },
        { seatId: 1, userId: 'user:1', name: 'P1', connected: true, controlledBy: 'human' },
        { seatId: 2, userId: 'user:2', name: 'P2', connected: true, controlledBy: 'human' },
        { seatId: 3, userId: 'user:3', name: 'P3', connected: true, controlledBy: 'human' },
      ],
      ...overrides,
    }
  }

  it('accepts a legal follow and rejects an illegal card', () => {
    const legalCard = c('hearts-2')
    const illegalCard = c('clubs-5')

    const state = midTrickState({
      hands: [
        [c('hearts-k')],
        [legalCard, illegalCard, c('trump-10')],
        [c('diamonds-3'), c('diamonds-4')],
        [c('spades-8'), c('spades-9')],
      ],
      trick: [{ seat: 0, card: c('hearts-7') }],
    })

    const legal = apply(state, { type: 'playCard', card: legalCard }, actorForSeat(state, 1))
    expect(legal.ok).toBe(true)
    if (!legal.ok) {
      return
    }
    expect(legal.state.trick).toEqual([
      { seat: 0, card: c('hearts-7') },
      { seat: 1, card: legalCard },
    ])
    expect(legal.state.hands[1]).not.toContain(legalCard)

    const illegal = apply(state, { type: 'playCard', card: illegalCard }, actorForSeat(state, 1))
    expect(illegal.ok).toBe(false)
    if (illegal.ok) {
      return
    }
    expect(illegal.error).toBe('ILLEGAL_MOVE')
  })

  it('forces following suit when able', () => {
    const state = midTrickState({
      hands: [
        [c('hearts-k')],
        [c('hearts-2'), c('clubs-5')],
        [c('diamonds-3')],
        [c('spades-8')],
      ],
      trick: [{ seat: 0, card: c('hearts-7') }],
    })

    const illegal = apply(
      state,
      { type: 'playCard', card: c('clubs-5') },
      actorForSeat(state, 1),
    )
    expect(illegal.ok).toBe(false)
    if (illegal.ok) {
      return
    }
    expect(illegal.error).toBe('ILLEGAL_MOVE')
  })
})

describe('publicView secrecy', () => {
  it('does not expose every seat full hand in the public view', () => {
    const state: GameState = {
      ...createEmptyGame({
        hostUserId: HOST,
        playerCount: 4,
        endMode: 'threshold',
        endValue: 1000,
      }),
      phase: 'Trick',
      version: 2,
      currentSeat: 1,
      hands: [
        [c('hearts-k'), c('trump-21'), c('excuse')],
        [c('hearts-2'), c('clubs-5')],
        [c('diamonds-3')],
        [c('spades-8')],
      ],
      bid: { seat: 0, contract: 'prise' },
      trick: [{ seat: 0, card: c('hearts-7') }],
      dealIndex: 1,
    }

    const view = toPublicView(state)
    expect(view.handCounts).toEqual([3, 2, 1, 1])
    expect(view).not.toHaveProperty('hands')

    const serialized = JSON.stringify(view)
    expect(serialized).not.toContain('"hearts-k"')
    expect(serialized).not.toContain('"trump-21"')
    expect(serialized).toContain('"hearts-7"')

    const privateView = toPrivateView(state, 0)
    expect(privateView.hand).toEqual(state.hands[0])
    expect(privateView.legalMoves.length).toBe(0)
  })
})

describe('bidState wiring smoke', () => {
  it('can construct mid-state bidding from createBidState', () => {
    const bidState = createBidState(4, 2)
    const base = createEmptyGame({
      hostUserId: HOST,
      playerCount: 4,
      endMode: 'threshold',
      endValue: 1000,
    })
    const state: GameState = {
      ...base,
      phase: 'Bidding',
      bidState,
      currentSeat: expectedSeat(bidState),
      dealIndex: 1,
      seats: base.seats.map((seat, index) =>
        index === 2
          ? { ...seat, userId: 'user:2', name: 'P2', connected: true }
          : seat,
      ),
    }

    const result = apply(state, { type: 'bid', bid: 'prise' }, actorForSeat(state, 2))
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.state.bidState?.spoken).toHaveLength(1)
  })
})
