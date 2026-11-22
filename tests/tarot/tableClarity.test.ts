import { describe, expect, it } from 'vitest'
import { apply } from '../../shared/tarot/apply'
import { chooseBotIntent } from '../../shared/tarot/botPolicy'
import { createEmptyGame } from '../../shared/tarot/createGame'
import { toPublicView } from '../../shared/tarot/publicView'
import { computeDealBreakdown, computeDealScore } from '../../shared/tarot/score'
import { SALON_CHARACTERS } from '../../shared/play/salonCharacters'
import type { GameState, PlayerCount } from '../../shared/tarot/types'
import { medallionSize, seatMedallion } from '../../app/utils/seatLayout'

const HOST = 'user:host'

function table(count: PlayerCount, seed = 11): GameState {
  let state = createEmptyGame({ hostUserId: HOST, hostName: 'Hôte', playerCount: count, endMode: 'deals', endValue: 2, deckId: 'deck', code: 'ABC123' })
  for (let i = 1; i < count; i++) {
    const added = apply(state, { type: 'addBot', level: 'facile' }, { userId: HOST })
    if (!added.ok) {
      throw new Error(added.reason)
    }
    state = added.state
  }
  // The host plays as a bot too, so the whole deal runs on its own.
  state = { ...state, seats: state.seats.map((seat, index) => index === 0 ? { ...seat, controlledBy: 'bot' as const } : seat), rngCounter: seed }
  const started = apply(state, { type: 'start' }, { userId: HOST })
  if (!started.ok) {
    throw new Error(started.reason)
  }
  return started.state
}

function step(state: GameState): GameState {
  let seat = state.currentSeat
  if (state.phase === 'DogEcarta' || (state.phase === 'ReadyToPlay' && state.bid && state.playerCount === 5 && !state.calledKing)) {
    seat = state.bid!.seat
  }
  const intent = chooseBotIntent(state, seat)
  const result = apply(state, intent, { userId: state.seats[seat]!.userId!, seat })
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.state
}

function playUntil(state: GameState, done: (s: GameState) => boolean) {
  for (let i = 0; i < 5000 && !done(state); i++) {
    state = step(state)
  }
  return state
}

describe('deal score breakdown', () => {
  it('gives the same deltas as before, with every step of the calculation', () => {
    const input = {
      playerCount: 4 as const,
      contract: 'garde' as const,
      takerSeat: 1,
      takerCards: ['trump-21', 'trump-1'] as never,
      defenseCards: []
    }
    const breakdown = computeDealBreakdown(input)
    expect(breakdown.deltas).toEqual(computeDealScore(input))
    expect(breakdown.oudlers).toBe(2)
    expect(breakdown.required).toBe(41)
    expect(breakdown.multiplier).toBe(2)
    expect(breakdown.success).toBe(false)
    expect(breakdown.perDefender).toBe((25 + Math.abs(breakdown.diff)) * 2)
  })
})

describe('live points and the end-of-deal sheet', () => {
  it.each([3, 4, 5] as const)('%i players: points won per seat add up to the 91 points of the deck', (count) => {
    let state = table(count)
    state = playUntil(state, s => s.phase === 'Scoring')
    if (state.phase !== 'Scoring') {
      throw new Error('no deal played on this seed')
    }
    const won = (state.pointsWonBySeat ?? []).reduce((a, b) => a + b, 0)
    const ecartLeft = 91 - won
    // The dog/écart is never in the tricks; everything else is.
    expect(ecartLeft).toBeGreaterThanOrEqual(0)
    expect(ecartLeft).toBeLessThanOrEqual(count === 5 ? 15 : 30)
    const view = toPublicView(state)
    expect(view.lastDeal?.deltas).toEqual(state.lastDeltas)
    expect(view.dealHistory).toHaveLength(1)
    expect(view.dealHistory?.[0]?.tricksWonBySeat.reduce((a, b) => a + b, 0)).toBe(count === 3 ? 24 : count === 4 ? 18 : 15)
  })

  it('pausing the summary stops the automatic next deal', () => {
    let state = playUntil(table(4, 5), s => s.phase === 'Scoring')
    state = { ...state, autoContinueAt: Date.now() + 15_000 }
    const held = apply(state, { type: 'holdScoring' }, { userId: HOST, seat: 0 })
    expect(held.ok).toBe(true)
    if (held.ok) {
      expect(held.state.scoringHeld).toBe(true)
      expect(held.state.autoContinueAt).toBeUndefined()
      const next = apply(held.state, { type: 'continue' }, { userId: HOST, seat: 0 })
      expect(next.ok && next.state.scoringHeld).toBeFalsy()
    }
    expect(apply(table(4), { type: 'holdScoring' }, { userId: HOST, seat: 0 }).ok).toBe(false)
  })
})

describe('bots play as salon characters', () => {
  it('each bot gets its own character name and portrait', () => {
    const state = table(5)
    const bots = state.seats.filter(seat => seat.controlledBy === 'bot' && seat.character)
    expect(bots).toHaveLength(4)
    expect(new Set(bots.map(seat => seat.character)).size).toBe(4)
    for (const seat of bots) {
      const character = SALON_CHARACTERS.find(c => c.id === seat.character)
      expect(character?.name).toBe(seat.name)
    }
    expect(toPublicView(state).seats[1]?.character).toBe(bots[0]?.character)
  })
})

describe('portraits around the felt', () => {
  const VIEWS = [
    { width: 390, height: 844, mobile: true },
    { width: 844, height: 390, mobile: false },
    { width: 1440, height: 900, mobile: false }
  ]
  it.each([3, 4, 5] as const)('%i players: every portrait is on screen and apart from the others', (count) => {
    for (const view of VIEWS) {
      const size = medallionSize(view)
      const points = Array.from({ length: count }, (_, seat) => seatMedallion(seat, 0, count, view))
      for (const point of points) {
        expect(point.x - size / 2).toBeGreaterThanOrEqual(0)
        expect(point.x + size / 2).toBeLessThanOrEqual(view.width)
        expect(point.y - size / 2).toBeGreaterThanOrEqual(0)
      }
      for (let a = 0; a < count; a++) {
        for (let b = a + 1; b < count; b++) {
          const distance = Math.hypot(points[a]!.x - points[b]!.x, points[a]!.y - points[b]!.y)
          expect(distance).toBeGreaterThan(size * 1.5)
        }
      }
    }
  })
})
