import { describe, expect, it } from 'vitest'
import {
  applyBid,
  createBidState,
  expectedSeat,
} from '../../shared/tarot/bid'
import type { BidState } from '../../shared/tarot/bid'

function applyAll(state: BidState, bids: Array<{ seat: number; bid: Parameters<typeof applyBid>[2] }>) {
  let current = state
  let lastOutcome: { type: 'all_pass' } | { type: 'won'; seat: number; contract: string } | undefined
  for (const { seat, bid } of bids) {
    const result = applyBid(current, seat, bid)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return result
    }
    current = result.state
    lastOutcome = result.outcome
  }
  return { ok: true as const, state: current, outcome: lastOutcome }
}

describe('createBidState', () => {
  it('starts with empty spoken and no winner', () => {
    const state = createBidState(4, 2)
    expect(state.playerCount).toBe(4)
    expect(state.firstBidderSeat).toBe(2)
    expect(state.spoken).toEqual([])
    expect(state.currentWinner).toBeNull()
    expect(expectedSeat(state)).toBe(2)
  })
})

describe('applyBid', () => {
  it('requires strict overcall when a contract is winning', () => {
    let state = createBidState(4, 0)

    const first = applyBid(state, 0, 'prise')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    state = first.state

    const sameBid = applyBid(state, 1, 'prise')
    expect(sameBid.ok).toBe(false)
    if (!sameBid.ok) {
      expect(sameBid.reason).toMatch(/overcall/i)
    }

    const higher = applyBid(state, 1, 'garde')
    expect(higher.ok).toBe(true)
    if (!higher.ok) return
    state = higher.state

    const lower = applyBid(state, 2, 'prise')
    expect(lower.ok).toBe(false)
    if (!lower.ok) {
      expect(lower.reason).toMatch(/overcall/i)
    }
  })

  it('returns all_pass when every seat passes', () => {
    const result = applyAll(createBidState(4, 1), [
      { seat: 1, bid: 'passe' },
      { seat: 2, bid: 'passe' },
      { seat: 3, bid: 'passe' },
      { seat: 0, bid: 'passe' },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.outcome).toEqual({ type: 'all_pass' })
  })

  it('awards garde when prise is overcalled later in the round', () => {
    const result = applyAll(createBidState(4, 0), [
      { seat: 0, bid: 'prise' },
      { seat: 1, bid: 'passe' },
      { seat: 2, bid: 'garde' },
      { seat: 3, bid: 'passe' },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.outcome).toEqual({
      type: 'won',
      seat: 2,
      contract: 'garde',
    })
  })

  it('allows each seat to speak only once and enforces seat order', () => {
    const state = createBidState(4, 0)
    expect(expectedSeat(state)).toBe(0)

    const wrongSeat = applyBid(state, 2, 'garde')
    expect(wrongSeat.ok).toBe(false)
    if (!wrongSeat.ok) {
      expect(wrongSeat.reason).toMatch(/turn/i)
    }

    const first = applyBid(state, 0, 'passe')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(expectedSeat(first.state)).toBe(1)

    const outOfTurn = applyBid(first.state, 0, 'garde')
    expect(outOfTurn.ok).toBe(false)
    if (!outOfTurn.ok) {
      expect(outOfTurn.reason).toMatch(/turn/i)
    }
  })

  it('rejects bids after the round is complete', () => {
    const done = applyAll(createBidState(3, 0), [
      { seat: 0, bid: 'passe' },
      { seat: 1, bid: 'passe' },
      { seat: 2, bid: 'passe' },
    ])
    expect(done.ok).toBe(true)
    if (!done.ok) return

    const extra = applyBid(done.state, 0, 'garde')
    expect(extra.ok).toBe(false)
  })
})
