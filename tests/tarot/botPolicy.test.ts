import { describe, expect, it } from 'vitest'
import { apply } from '../../shared/tarot/apply'
import { createBidState, expectedSeat } from '../../shared/tarot/bid'
import { chooseBotIntent } from '../../shared/tarot/botPolicy'
import { createEmptyGame } from '../../shared/tarot/createGame'
import { validateEcart } from '../../shared/tarot/ecart'
import { legalMoves } from '../../shared/tarot/legalMoves'
import { toPrivateView } from '../../shared/tarot/publicView'
import { trickLedSuit } from '../../shared/tarot/trick'
import type { CardId, GameState } from '../../shared/tarot/types'

const c = (id: string) => id as CardId
const HOST = 'user:host'

function actorForSeat(state: GameState, seat: number) {
  const userId = state.seats[seat]?.userId
  if (!userId) {
    throw new Error(`Seat ${seat} has no user`)
  }
  return { userId, seat }
}

function biddingState(hand: CardId[], overrides: Partial<GameState> = {}): GameState {
  const bidState = createBidState(4, 1)
  const base = createEmptyGame({
    hostUserId: HOST,
    playerCount: 4,
    endMode: 'threshold',
    endValue: 1000,
    deckId: 'deck-test',
  })
  return {
    ...base,
    phase: 'Bidding',
    version: 1,
    dealerSeat: 0,
    currentSeat: expectedSeat(bidState),
    bidState,
    bidSpoken: [],
    dealIndex: 1,
    rngCounter: 1,
    hands: [
      [c('hearts-1'), c('hearts-2'), c('hearts-3')],
      hand,
      [c('clubs-1'), c('clubs-2'), c('clubs-3')],
      [c('diamonds-1'), c('diamonds-2'), c('diamonds-3')],
    ],
    chien: [c('spades-1'), c('spades-2'), c('spades-3'), c('spades-4'), c('spades-5'), c('spades-6')],
    seats: base.seats.map((seat, index) => ({
      ...seat,
      userId: `user:${index}`,
      name: `P${index}`,
      connected: true,
      controlledBy: index === 1 ? 'bot' as const : 'human' as const,
    })),
    ...overrides,
  }
}

function playState(overrides: Partial<GameState> = {}): GameState {
  const base = createEmptyGame({
    hostUserId: HOST,
    playerCount: 4,
    endMode: 'threshold',
    endValue: 1000,
    deckId: 'deck-test',
  })
  return {
    ...base,
    phase: 'Trick',
    version: 1,
    dealerSeat: 0,
    currentSeat: 1,
    bid: { seat: 0, contract: 'prise' },
    bidState: null,
    bidSpoken: [],
    chien: [],
    ecart: [],
    pilesAttack: [],
    pilesDefense: [],
    dealIndex: 1,
    rngCounter: 1,
    seats: base.seats.map((seat, index) => ({
      ...seat,
      userId: `user:${index}`,
      name: `P${index}`,
      connected: true,
      controlledBy: 'bot' as const,
    })),
    ...overrides,
  }
}

describe('chooseBotIntent bidding', () => {
  it('passes with a weak hand (few trumps, no oudler)', () => {
    const hand = [
      c('trump-2'), c('trump-5'),
      c('hearts-1'), c('hearts-2'), c('clubs-3'), c('diamonds-4'),
    ]
    const state = biddingState(hand)
    const intent = chooseBotIntent(state, 1)
    expect(intent).toEqual({ type: 'bid', bid: 'passe' })
  })

  it('passes with four trumps but no oudler', () => {
    const hand = [
      c('trump-2'), c('trump-5'), c('trump-10'), c('trump-15'),
      c('hearts-1'), c('hearts-2'),
    ]
    const state = biddingState(hand)
    expect(chooseBotIntent(state, 1)).toEqual({ type: 'bid', bid: 'passe' })
  })

  it('bids prise with four real trumps and an oudler on its turn', () => {
    const hand = [
      c('trump-1'), c('trump-5'), c('trump-10'), c('trump-15'),
      c('hearts-1'), c('excuse'),
    ]
    const state = biddingState(hand)
    const intent = chooseBotIntent(state, 1)
    expect(intent).toEqual({ type: 'bid', bid: 'prise' })

    const result = apply(state, intent, actorForSeat(state, 1))
    expect(result.ok).toBe(true)
  })

  it('bids garde_contre with a monster trump + oudler hand', () => {
    const hand = [
      c('trump-1'), c('trump-21'), c('trump-14'), c('trump-15'), c('trump-16'), c('trump-18'),
      c('excuse'), c('hearts-k'), c('spades-k'),
    ]
    const state = biddingState(hand)
    expect(chooseBotIntent(state, 1)).toEqual({ type: 'bid', bid: 'garde_contre' })
  })

  it('overcalls beyond prise when a strong hand faces an existing prise', () => {
    const hand = [
      c('trump-1'), c('trump-14'), c('trump-15'), c('trump-16'), c('trump-10'),
      c('excuse'), c('hearts-k'),
    ]
    let bidState = createBidState(4, 0)
    bidState = {
      ...bidState,
      spoken: [{ seat: 0, bid: 'prise' }],
      currentWinner: { seat: 0, contract: 'prise' },
    }
    const state = biddingState(hand, {
      bidState,
      currentSeat: expectedSeat(bidState),
    })
    const intent = chooseBotIntent(state, 1)
    expect(intent.type).toBe('bid')
    if (intent.type === 'bid') {
      expect(['garde', 'garde_sans', 'garde_contre']).toContain(intent.bid)
    }
  })

  it('passes when a marginal prise hand cannot stretch over an existing prise', () => {
    const hand = [
      c('trump-1'), c('trump-5'), c('trump-8'), c('trump-10'),
      c('hearts-1'), c('hearts-2'),
    ]
    let bidState = createBidState(4, 0)
    const first = { seat: 0, bid: 'prise' as const }
    bidState = {
      ...bidState,
      spoken: [first],
      currentWinner: { seat: 0, contract: 'prise' },
    }

    const state = biddingState(hand, {
      bidState,
      currentSeat: expectedSeat(bidState),
    })

    expect(state.currentSeat).toBe(1)
    expect(chooseBotIntent(state, 1)).toEqual({ type: 'bid', bid: 'passe' })
  })
})

describe('chooseBotIntent DogEcarta', () => {
  it('discards validateEcart-legal cards preferring low non-trumps', () => {
    const hand = [
      c('hearts-1'), c('hearts-2'), c('hearts-3'), c('hearts-4'), c('hearts-5'), c('hearts-6'),
      c('hearts-7'), c('hearts-8'), c('hearts-9'), c('hearts-10'), c('hearts-j'), c('hearts-q'),
      c('trump-3'), c('trump-4'), c('trump-5'), c('trump-6'), c('trump-7'), c('trump-8'),
      c('trump-1'), c('trump-21'), c('excuse'), c('hearts-k'),
    ]
    const state = playState({
      phase: 'DogEcarta',
      currentSeat: 0,
      bid: { seat: 0, contract: 'prise' },
      hands: [hand, [], [], []],
    })

    const intent = chooseBotIntent(state, 0)
    expect(intent.type).toBe('discard')
    if (intent.type !== 'discard') {
      return
    }
    expect(intent.cards).toHaveLength(6)
    const validation = validateEcart(hand, intent.cards, 6)
    expect(validation.ok).toBe(true)
    expect(intent.cards).not.toContain(c('hearts-k'))
    expect(intent.cards).not.toContain(c('trump-1'))
    expect(intent.cards).not.toContain(c('trump-21'))
    expect(intent.cards).not.toContain(c('excuse'))
    expect(intent.cards.every(card => !card.startsWith('trump-'))).toBe(true)
  })
})

describe('chooseBotIntent play', () => {
  it('plays a card from legalMoves', () => {
    const state = playState({
      hands: [
        [c('hearts-k')],
        [c('hearts-2'), c('clubs-5'), c('trump-10')],
        [c('diamonds-3')],
        [c('spades-8')],
      ],
      trick: [{ seat: 0, card: c('hearts-7') }],
    })

    const intent = chooseBotIntent(state, 1)
    expect(intent.type).toBe('playCard')
    if (intent.type !== 'playCard') {
      return
    }

    const moves = toPrivateView(state, 1).legalMoves
    expect(moves).toContain(intent.card)

    const result = apply(state, intent, actorForSeat(state, 1))
    expect(result.ok).toBe(true)
  })

  it('prefers the lowest card that follows suit', () => {
    const state = playState({
      hands: [
        [c('hearts-k')],
        [c('hearts-2'), c('hearts-9'), c('clubs-5')],
        [c('diamonds-3')],
        [c('spades-8')],
      ],
      trick: [{ seat: 0, card: c('hearts-7') }],
    })

    const intent = chooseBotIntent(state, 1)
    expect(intent).toEqual({ type: 'playCard', card: c('hearts-2') })
  })

  it('chooses legal cards for varied trick states', () => {
    const scenarios: Array<Partial<GameState>> = [
      {
        hands: [[c('hearts-k')], [c('trump-3'), c('trump-20'), c('clubs-5')], [], []],
        trick: [
          { seat: 0, card: c('hearts-7') },
          { seat: 2, card: c('trump-7') },
        ],
        currentSeat: 1,
      },
      {
        phase: 'ReadyToPlay',
        hands: [[c('hearts-2'), c('clubs-3')], [c('diamonds-4')], [], []],
        trick: [],
        currentSeat: 0,
      },
      {
        hands: [[c('hearts-k')], [c('clubs-5'), c('diamonds-j')], [], []],
        trick: [{ seat: 0, card: c('hearts-7') }],
        currentSeat: 1,
      },
    ]

    for (const overrides of scenarios) {
      const state = playState(overrides)
      const seat = state.currentSeat
      const intent = chooseBotIntent(state, seat)
      expect(intent.type).toBe('playCard')
      if (intent.type !== 'playCard') {
        continue
      }

      const hand = state.hands[seat] ?? []
      const ledSuit = state.trick.length > 0 ? trickLedSuit(state.trick) : null
      const moves = legalMoves(hand, state.trick, ledSuit)
      expect(moves).toContain(intent.card)
    }
  })
})

describe('chooseBotIntent guardrails', () => {
  it('throws when not the seat turn', () => {
    const state = playState({ currentSeat: 2 })
    expect(() => chooseBotIntent(state, 1)).toThrow(/turn/i)
  })

  it('throws in unsupported phases on turn', () => {
    const state = createEmptyGame({
      hostUserId: HOST,
      playerCount: 4,
      endMode: 'threshold',
      endValue: 1000,
    deckId: 'deck-test',
    })
    expect(() => chooseBotIntent(state, 0)).toThrow(/phase/i)
  })
})
