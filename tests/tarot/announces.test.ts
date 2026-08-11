import { describe, expect, it } from 'vitest'
import { apply } from '../../shared/tarot/apply'
import { createEmptyGame } from '../../shared/tarot/createGame'
import type { CardId, GameState } from '../../shared/tarot/types'

const HOST = 'host-1'
const c = (id: string) => id as CardId

function actorForSeat(state: GameState, seat: number) {
  return { userId: state.seats[seat]!.userId!, seat }
}

function baseReady(playerCount: 3 | 4 | 5, overrides: Partial<GameState> = {}): GameState {
  const base = createEmptyGame({
    hostUserId: HOST,
    playerCount,
    endMode: 'deals',
    endValue: 10,
    deckId: 'deck-test',
  })
  const seats = base.seats.map((seat, index) => ({
    ...seat,
    userId: `user:${index}`,
    name: `P${index}`,
    connected: true,
  }))
  return {
    ...base,
    phase: 'ReadyToPlay',
    seats,
    bid: { seat: 0, contract: 'prise' },
    currentSeat: 1,
    dealIndex: 1,
    attackTricks: 0,
    defenseTricks: 0,
    hands: Array.from({ length: playerCount }, () => [] as CardId[]),
    ...overrides,
  }
}

describe('callKing (5p)', () => {
  it('resolves partnerSeat to the holder of the called king', () => {
    const state = baseReady(5, {
      phase: 'DogEcarta',
      currentSeat: 0,
      hands: [
        [c('hearts-1'), c('clubs-2'), c('clubs-3')],
        [c('hearts-k'), c('diamonds-2')],
        [c('spades-3')],
        [c('spades-4')],
        [c('spades-5')],
      ],
    })

    const result = apply(state, { type: 'callKing', king: c('hearts-k') }, actorForSeat(state, 0))
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.state.calledKing).toBe('hearts-k')
    expect(result.state.partnerSeat).toBe(1)
  })

  it('leaves partnerSeat undefined when taker holds the king (alone)', () => {
    const state = baseReady(5, {
      phase: 'DogEcarta',
      currentSeat: 0,
      hands: [
        [c('hearts-k'), c('clubs-2')],
        [c('diamonds-2')],
        [c('spades-3')],
        [c('spades-4')],
        [c('spades-5')],
      ],
    })

    const result = apply(state, { type: 'callKing', king: c('hearts-k') }, actorForSeat(state, 0))
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.state.partnerSeat).toBeUndefined()
  })
})

describe('poignée', () => {
  it('rejects tier not allowed for player count', () => {
    const trumps = Array.from({ length: 12 }, (_, i) => c(`trump-${i + 1}`))
    const state = baseReady(4, {
      currentSeat: 0,
      hands: [trumps, [], [], []],
    })
    const result = apply(state, { type: 'announcePoignee', tier: 8 }, actorForSeat(state, 0))
    expect(result.ok).toBe(false)
  })

  it('accepts valid 4p simple poignée with enough trumps', () => {
    const trumps = [...Array.from({ length: 9 }, (_, i) => c(`trump-${i + 1}`)), c('excuse')]
    const state = baseReady(4, {
      currentSeat: 0,
      hands: [trumps, [], [], []],
    })
    const result = apply(state, { type: 'announcePoignee', tier: 10 }, actorForSeat(state, 0))
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.state.poigneeShown).toEqual({ seat: 0, tier: 10 })
  })
})

describe('chelem detection', () => {
  it('marks announced_failed when attack does not take every trick', () => {
    const state = baseReady(4, {
      phase: 'Trick',
      chelemAnnounce: 'announced',
      attackTricks: 5,
      defenseTricks: 12,
      currentSeat: 3,
      pilesAttack: [c('trump-21')],
      pilesDefense: [c('hearts-k')],
      hands: [[], [], [], [c('hearts-2')]],
      trick: [
        { seat: 0, card: c('hearts-3') },
        { seat: 1, card: c('hearts-4') },
        { seat: 2, card: c('hearts-5') },
      ],
      bid: { seat: 0, contract: 'garde_sans' },
      chien: [],
      scores: [0, 0, 0, 0],
    })

    const result = apply(state, { type: 'playCard', card: c('hearts-2') }, actorForSeat(state, 3))
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.state.phase).toBe('Scoring')
    // announced failed: -200 in S → taker gets 3*(-200-contract) which is large negative
    expect(result.state.lastDeltas![0]).toBeLessThan(0)
  })

  it('credits unannounced_made when attack takes all tricks', () => {
    const state = baseReady(4, {
      phase: 'Trick',
      attackTricks: 17,
      defenseTricks: 0,
      currentSeat: 3,
      pilesAttack: [
        c('trump-21'),
        c('trump-1'),
        c('excuse'),
        c('hearts-k'),
        c('hearts-q'),
        c('hearts-c'),
        c('hearts-j'),
        c('hearts-10'),
        c('diamonds-k'),
        c('diamonds-q'),
        c('clubs-k'),
        c('clubs-q'),
        c('spades-k'),
        c('spades-q'),
        c('hearts-9'),
        c('hearts-8'),
        c('hearts-7'),
      ],
      pilesDefense: [],
      hands: [[], [], [], [c('trump-2')]],
      trick: [
        { seat: 0, card: c('trump-21') },
        { seat: 1, card: c('hearts-3') },
        { seat: 2, card: c('hearts-4') },
      ],
      bid: { seat: 0, contract: 'garde_sans' },
      chien: [c('hearts-6'), c('hearts-1'), c('diamonds-1'), c('clubs-1'), c('spades-1'), c('trump-3')],
      scores: [0, 0, 0, 0],
    })

    // Fix: trump-21 already played in trick — seat 0 can't have played it from empty hand.
    // Use a fresh trump lead from attack that still wins.
    state.trick = [
      { seat: 0, card: c('trump-20') },
      { seat: 1, card: c('hearts-3') },
      { seat: 2, card: c('hearts-4') },
    ]
    state.pilesAttack = state.pilesAttack.filter(card => card !== 'trump-21')
    state.pilesAttack.push(c('trump-21'))

    const result = apply(state, { type: 'playCard', card: c('trump-2') }, actorForSeat(state, 3))
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.state.phase).toBe('Scoring')
    expect(result.state.attackTricks).toBe(18)
    expect(result.state.defenseTricks).toBe(0)
    expect(result.state.lastDeltas![0]).toBeGreaterThan(0)
  })
})
