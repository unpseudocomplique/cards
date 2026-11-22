import { describe, expect, it } from 'vitest'
import { callableCards } from '../../shared/tarot/announces'
import { apply } from '../../shared/tarot/apply'
import { createEmptyGame } from '../../shared/tarot/createGame'
import { toPrivateView, toPublicView } from '../../shared/tarot/publicView'
import { computeDealScore, roundTakerPoints } from '../../shared/tarot/score'
import type { CardId, GameState } from '../../shared/tarot/types'

const c = (id: string) => id as CardId
const cards = (...ids: string[]) => ids.map(c)

function actor(state: GameState, seat: number) {
  return { userId: state.seats[seat]!.userId!, seat }
}

function table(playerCount: 3 | 4 | 5, overrides: Partial<GameState> = {}): GameState {
  const base = createEmptyGame({
    hostUserId: 'host',
    playerCount,
    endMode: 'deals',
    endValue: 10,
    deckId: 'deck-test'
  })
  return {
    ...base,
    phase: 'Trick',
    seats: base.seats.map((seat, index) => ({ ...seat, userId: `user:${index}`, name: `P${index}`, connected: true })),
    bid: { seat: 0, contract: 'prise' },
    dealIndex: 1,
    scores: Array.from({ length: playerCount }, () => 0),
    hands: Array.from({ length: playerCount }, () => [] as CardId[]),
    ...overrides
  }
}

/** 41 points with 2 bouts: exactly what the taker needs. */
const TAKER_41_TWO_BOUTS = cards(
  'trump-21', 'trump-1',
  'hearts-k', 'diamonds-k', 'clubs-k', 'spades-k',
  'hearts-q', 'diamonds-q', 'clubs-q', 'spades-q'
)

function play(state: GameState, seat: number, card: string): GameState {
  const result = apply(state, { type: 'playCard', card: c(card) }, actor(state, seat))
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.state
}

describe('Excuse on the last trick', () => {
  it('goes to the camp that wins the trick', () => {
    const state = table(4, {
      attackTricks: 5,
      defenseTricks: 12,
      currentSeat: 3,
      hands: [[], [], [], cards('hearts-3')],
      trick: [
        { seat: 0, card: c('excuse') },
        { seat: 1, card: c('hearts-k') },
        { seat: 2, card: c('hearts-2') }
      ]
    })
    const next = play(state, 3, 'hearts-3')
    expect(next.pilesDefense).toContain('excuse')
    expect(next.pilesAttack).not.toContain('excuse')
    expect(next.excuseOwedBy).toBeUndefined()
  })

  it('wins the trick when its camp made every trick before (chelem)', () => {
    const state = table(4, {
      chelemAnnounce: 'announced',
      attackTricks: 17,
      defenseTricks: 0,
      currentSeat: 3,
      pilesAttack: [...TAKER_41_TWO_BOUTS],
      hands: [[], [], [], cards('trump-2')],
      trick: [
        { seat: 0, card: c('excuse') },
        { seat: 1, card: c('hearts-2') },
        { seat: 2, card: c('trump-5') }
      ]
    })
    const next = play(state, 3, 'trump-2')
    expect(next.lastTrickWinnerSeat).toBe(0)
    expect(next.attackTricks).toBe(18)
    expect(next.defenseTricks).toBe(0)
    expect(next.pilesAttack).toEqual(expect.arrayContaining(cards('excuse', 'hearts-2', 'trump-5', 'trump-2')))
    // Announced and made: the 400 prime is in the score.
    expect(next.lastDeltas![0]).toBeGreaterThan(3 * 400)
  })

  it('counts the Petit au bout on the second-to-last trick in that case', () => {
    const state = table(4, {
      attackTricks: 17,
      defenseTricks: 0,
      petitTrick: { number: 17, camp: 'attack' },
      currentSeat: 3,
      pilesAttack: [...TAKER_41_TWO_BOUTS],
      hands: [[], [], [], cards('hearts-4')],
      trick: [
        { seat: 0, card: c('excuse') },
        { seat: 1, card: c('hearts-2') },
        { seat: 2, card: c('hearts-3') }
      ]
    })
    const next = play(state, 3, 'hearts-4')
    expect(next.petitAuBoutCamp).toBe('attack')
  })
})

describe('Excuse exchange', () => {
  it('stays with its camp, which then owes a low card', () => {
    const state = table(4, {
      currentSeat: 3,
      hands: [cards('clubs-2'), cards('clubs-3'), cards('clubs-4'), cards('hearts-3', 'clubs-5')],
      trick: [
        { seat: 0, card: c('excuse') },
        { seat: 1, card: c('hearts-k') },
        { seat: 2, card: c('hearts-2') }
      ]
    })
    const next = play(state, 3, 'hearts-3')
    expect(next.pilesAttack).toEqual(['excuse'])
    expect(next.excuseOwedBy).toBe('attack')
  })

  it('costs the owing camp half a point', () => {
    const base = {
      playerCount: 4 as const,
      contract: 'prise' as const,
      takerSeat: 0,
      takerCards: TAKER_41_TWO_BOUTS,
      defenseCards: []
    }
    expect(computeDealScore(base)[0]).toBe(75)
    // 40.5 points: the half point goes to the winning camp (defence) → fails by 1.
    expect(computeDealScore({ ...base, takerPointsAdjust: -0.5 })[0]).toBe(-78)
  })
})

describe('half point', () => {
  it('always goes to the camp that wins the deal', () => {
    expect(roundTakerPoints(40.5, 41)).toBe(40)
    expect(roundTakerPoints(41.5, 41)).toBe(42)
  })
})

describe('dog in garde sans / garde contre', () => {
  const dog = cards('excuse', 'hearts-c', 'diamonds-c', 'clubs-c', 'spades-c', 'hearts-j')
  const lastTrick = (contract: 'garde_sans' | 'garde_contre') => table(4, {
    bid: { seat: 0, contract },
    chien: dog,
    attackTricks: 10,
    defenseTricks: 7,
    currentSeat: 3,
    pilesAttack: [...TAKER_41_TWO_BOUTS],
    hands: [[], [], [], cards('hearts-5')],
    trick: [
      { seat: 0, card: c('hearts-2') },
      { seat: 1, card: c('hearts-3') },
      { seat: 2, card: c('hearts-4') }
    ]
  })

  it('garde contre: the dog counts for the defence', () => {
    // 41 points, 2 bouts: made by 0 → (25 + 0) × 6 × 3 defenders.
    expect(play(lastTrick('garde_contre'), 3, 'hearts-5').lastDeltas![0]).toBe(450)
  })

  it('garde sans: the dog counts for the taker', () => {
    // 57 points, 3 bouts: made by 21 → (25 + 21) × 4 × 3.
    expect(play(lastTrick('garde_sans'), 3, 'hearts-5').lastDeltas![0]).toBe(552)
  })
})

describe('chelem announce', () => {
  it('gives the opening lead to the taker', () => {
    const state = table(4, { phase: 'ReadyToPlay', currentSeat: 1 })
    const result = apply(state, { type: 'announceChelem', kind: 'announced' }, actor(state, 0))
    expect(result.ok && result.state.currentSeat).toBe(0)
  })
})

describe('écart', () => {
  it('shows the trumps the taker had to discard', () => {
    const hand = cards(
      'hearts-k', 'diamonds-k', 'clubs-k', 'spades-k', 'trump-21', 'trump-1', 'excuse',
      ...Array.from({ length: 15 }, (_, i) => `trump-${i + 2}`),
      'hearts-2', 'hearts-3'
    )
    const state = table(4, { phase: 'DogEcarta', currentSeat: 0, hands: [hand, [], [], []] })
    const discard = cards('hearts-2', 'hearts-3', 'trump-2', 'trump-3', 'trump-4', 'trump-5')
    const result = apply(state, { type: 'discard', cards: discard }, actor(state, 0))
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(toPublicView(result.state).ecartShownTrumps).toEqual(cards('trump-2', 'trump-3', 'trump-4', 'trump-5'))
  })
})

describe('poignée', () => {
  const fillers = (n: number) => Array.from({ length: n }, (_, i) => c(`clubs-${i + 1}`))
  const tenTrumps = Array.from({ length: 10 }, (_, i) => c(`trump-${i + 2}`))

  it('can be shown by a defender just before their first card, after others played', () => {
    const state = table(4, {
      currentSeat: 2,
      hands: [[], [], [...tenTrumps, ...fillers(8)], []],
      trick: [{ seat: 0, card: c('hearts-2') }, { seat: 1, card: c('hearts-3') }],
      poignees: [{ seat: 0, tier: 10, cards: [] }]
    })
    const result = apply(state, { type: 'announcePoignee', tier: 10 }, actor(state, 2))
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.state.poignees).toHaveLength(2)
    expect(result.state.poignees![1]).toEqual({ seat: 2, tier: 10, cards: tenTrumps })
  })

  it('is refused once the player has played a card', () => {
    const state = table(4, {
      currentSeat: 2,
      hands: [[], [], [...tenTrumps, ...fillers(7)], []]
    })
    expect(apply(state, { type: 'announcePoignee', tier: 10 }, actor(state, 2)).ok).toBe(false)
  })

  it('only shows the Excuse when no other trump is left', () => {
    const state = table(4, {
      currentSeat: 0,
      hands: [[...tenTrumps, c('excuse'), ...fillers(7)], [], [], []]
    })
    const result = apply(state, { type: 'announcePoignee', tier: 10 }, actor(state, 0))
    expect(result.ok && result.state.poignees![0]!.cards).toEqual(tenTrumps)

    const nineTrumps = tenTrumps.slice(1)
    const withExcuse = table(4, {
      currentSeat: 0,
      hands: [[...nineTrumps, c('excuse'), ...fillers(8)], [], [], []]
    })
    const result2 = apply(withExcuse, { type: 'announcePoignee', tier: 10 }, actor(withExcuse, 0))
    expect(result2.ok && result2.state.poignees![0]!.cards).toEqual([...nineTrumps, 'excuse'])
  })
})

describe('5 players', () => {
  it('allows calling a queen only with the 4 kings', () => {
    expect(callableCards(cards('hearts-k', 'diamonds-k', 'clubs-k'))).toEqual(cards('hearts-k', 'diamonds-k', 'clubs-k', 'spades-k'))
    const fourKings = cards('hearts-k', 'diamonds-k', 'clubs-k', 'spades-k')
    expect(callableCards(fourKings)).toEqual([...fourKings, ...cards('hearts-q', 'diamonds-q', 'clubs-q', 'spades-q')])
  })

  it('accepts a queen call from a taker holding the 4 kings', () => {
    const state = table(5, {
      phase: 'ReadyToPlay',
      bid: { seat: 0, contract: 'garde_sans' },
      currentSeat: 1,
      hands: [cards('hearts-k', 'diamonds-k', 'clubs-k', 'spades-k'), cards('hearts-q'), [], [], []]
    })
    const result = apply(state, { type: 'callKing', king: c('hearts-q') }, actor(state, 0))
    expect(result.ok && result.state.partnerSeat).toBe(1)
    const noKings = { ...state, hands: [cards('hearts-k'), cards('hearts-q'), [], [], []] }
    expect(apply(noKings, { type: 'callKing', king: c('hearts-q') }, actor(noKings, 0)).ok).toBe(false)
  })

  it('forbids opening in the called suit, except with the called king', () => {
    const state = table(5, {
      phase: 'ReadyToPlay',
      calledKing: c('hearts-k'),
      partnerSeat: 1,
      currentSeat: 1,
      hands: [[], cards('hearts-k', 'hearts-3', 'clubs-4'), [], [], []]
    })
    expect(toPrivateView(state, 1).legalMoves).toEqual(cards('hearts-k', 'clubs-4'))
    expect(apply(state, { type: 'playCard', card: c('hearts-3') }, actor(state, 1)).ok).toBe(false)
    // Later leads are free.
    const later = { ...state, phase: 'Trick' as const, attackTricks: 1 }
    expect(toPrivateView(later, 1).legalMoves).toContain('hearts-3')
  })
})
