import { describe, expect, it } from 'vitest'
import { apply } from '../../shared/tarot/apply'
import { createEmptyGame } from '../../shared/tarot/createGame'
import { toPublicView } from '../../shared/tarot/publicView'
import type { CardId, GameState } from '../../shared/tarot/types'

const c = (id: string) => id as CardId

function table(): GameState {
  const base = createEmptyGame({ hostUserId: 'host', playerCount: 3, endMode: 'deals', endValue: 10, deckId: 'deck-test' })
  return {
    ...base,
    phase: 'Trick',
    seats: base.seats.map((seat, index) => ({ ...seat, userId: `user:${index}`, name: `P${index}`, connected: true })),
    bid: { seat: 0, contract: 'prise' },
    dealIndex: 1,
    scores: [0, 0, 0],
    currentSeat: 0,
    hands: [[c('hearts-3'), c('clubs-2')], [c('hearts-k'), c('clubs-5')], [c('hearts-2'), c('clubs-9')]]
  }
}

function play(state: GameState, seat: number, card: string): GameState {
  const result = apply(state, { type: 'playCard', card: c(card) }, { userId: `user:${seat}`, seat })
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.state
}

describe('previous trick in the public view', () => {
  it('is empty before the first trick is complete', () => {
    expect(toPublicView(play(table(), 0, 'hearts-3')).previousTrick).toBeNull()
  })

  it('stays available after the next card, until the next trick is complete', () => {
    let state = play(play(play(table(), 0, 'hearts-3'), 1, 'hearts-k'), 2, 'hearts-2')
    expect(toPublicView(state).previousTrick).toEqual({
      cards: [{ seat: 0, card: 'hearts-3' }, { seat: 1, card: 'hearts-k' }, { seat: 2, card: 'hearts-2' }],
      winnerSeat: 1
    })
    // The winner leads: lastTrick is cleared, the previous trick is not.
    state = play(state, 1, 'clubs-5')
    expect(state.lastTrick).toBeNull()
    expect(toPublicView(state).previousTrick?.winnerSeat).toBe(1)
    expect(toPublicView(state).previousTrick?.cards.map(entry => entry.card)).toContain('hearts-k')
  })
})
