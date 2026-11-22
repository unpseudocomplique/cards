import { describe, expect, it } from 'vitest'
import { apply } from '../../shared/tarot/apply'
import { chooseBotIntent } from '../../shared/tarot/botPolicy'
import { createEmptyGame } from '../../shared/tarot/createGame'
import { validateEcart } from '../../shared/tarot/ecart'
import type { BotLevel, CardId, GameState, PlayerCount } from '../../shared/tarot/types'

const c = (id: string) => id as CardId
const HOST = 'user:host'
const LEVELS: BotLevel[] = ['facile', 'moyen', 'difficile']

function startedTable(playerCount: PlayerCount, seed: number): GameState {
  let state = createEmptyGame({ hostUserId: HOST, playerCount, endMode: 'deals', endValue: 5, deckId: 'deck-test' })
  for (let i = 1; i < playerCount; i++) {
    const added = apply(state, { type: 'addBot', level: 'difficile' }, { userId: HOST })
    if (!added.ok) {
      throw new Error(added.reason)
    }
    state = added.state
  }
  state = { ...state, rngCounter: seed }
  const started = apply(state, { type: 'start' }, { userId: HOST })
  if (!started.ok) {
    throw new Error(started.reason)
  }
  return started.state
}

function actingSeat(state: GameState): number {
  if (state.playerCount === 5 && state.bid && !state.calledKing
    && (state.phase === 'DogEcarta' || state.phase === 'ReadyToPlay')) {
    return state.bid.seat
  }
  return state.currentSeat
}

function step(state: GameState): GameState {
  const seat = actingSeat(state)
  const intent = chooseBotIntent(state, seat, 'moyen')
  const userId = state.seats[seat]!.userId!
  const result = apply(state, intent, { userId, seat })
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.state
}

/** Swap the hidden cards of every other seat at random, keeping hand sizes. */
function reshuffleOthers(state: GameState, seat: number, salt: number): GameState {
  const others = state.hands.map((_, s) => s).filter(s => s !== seat)
  const pool = others.flatMap(s => state.hands[s]!)
  let x = salt
  for (let i = pool.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) >>> 0
    const j = x % (i + 1)
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  const hands = state.hands.map(hand => [...hand])
  let offset = 0
  for (const s of others) {
    hands[s] = pool.slice(offset, offset + state.hands[s]!.length)
    offset += state.hands[s]!.length
  }
  return { ...state, hands }
}

describe('bots play fair', () => {
  it.each([4, 5] as const)('never look at other hands (%i players)', (count) => {
    let checked = 0
    for (let seed = 3; seed < 40 && checked < 25; seed += 7) {
      let state = startedTable(count, seed)
      while (state.phase !== 'Trick' || state.trick.length === 0 || (state.playedTricks?.length ?? 0) < 3) {
        if (state.phase === 'Scoring' || (state.phase === 'Bidding' && state.dealIndex > 1)) {
          break
        }
        state = step(state)
      }
      if (state.phase !== 'Trick') {
        continue
      }
      // 5 players: keep the called card where it is, its holder knows it.
      const seat = state.currentSeat
      const king = state.calledKing
      const kingHolder = king ? state.hands.findIndex(h => h.includes(king)) : -1
      if (kingHolder >= 0 && kingHolder !== seat) {
        continue
      }
      for (const level of LEVELS) {
        const expected = chooseBotIntent(state, seat, level)
        for (const salt of [1, 2, 3]) {
          const twin = reshuffleOthers(state, seat, salt * 7777 + seed)
          expect(chooseBotIntent(twin, seat, level)).toEqual(expected)
        }
      }
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('bot announcements and écart', () => {
  it('shows a poignée before its first card', () => {
    let state = startedTable(4, 11)
    while (state.phase !== 'ReadyToPlay' && state.phase !== 'Trick') {
      state = step(state)
      if (state.phase === 'Scoring') {
        return
      }
    }
    const seat = state.currentSeat
    const trumps = Array.from({ length: 11 }, (_, i) => c(`trump-${i + 2}`))
    const others = state.hands[seat]!.filter(card => !card.startsWith('trump-') && card !== 'excuse').slice(0, state.hands[seat]!.length - trumps.length)
    if (others.length + trumps.length !== state.hands[seat]!.length) {
      return
    }
    // Give the leader 11 trumps (the cards' real owners do not matter here).
    const hand = [...trumps, ...others]
    const hands = state.hands.map((h, s) => (s === seat ? hand : h.filter(card => !trumps.includes(card))))
    const twin = { ...state, hands }
    const intent = chooseBotIntent(twin, seat, 'difficile')
    expect(intent).toEqual({ type: 'announcePoignee', tier: 10 })
    const applied = apply(twin, intent, { userId: twin.seats[seat]!.userId!, seat })
    expect(applied.ok).toBe(true)
    if (applied.ok) {
      expect(chooseBotIntent(applied.state, seat, 'difficile').type).toBe('playCard')
    }
  })

  it('makes a void and banks unprotected honours in the écart', () => {
    const hand = [
      'trump-21', 'trump-3', 'trump-6', 'trump-9', 'trump-12', 'trump-14', 'trump-17', 'trump-19',
      'hearts-k', 'hearts-q', 'hearts-4', 'hearts-7',
      'clubs-q', 'clubs-3',
      'diamonds-c', 'diamonds-2', 'diamonds-5',
      'spades-k', 'spades-2', 'spades-6', 'spades-8', 'spades-9', 'spades-10', 'spades-j'
    ].map(c)
    let state = startedTable(4, 5)
    state = {
      ...state,
      phase: 'DogEcarta',
      bid: { seat: 0, contract: 'garde' },
      bidState: null,
      currentSeat: 0,
      hands: [hand, [], [], []]
    }
    const intent = chooseBotIntent(state, 0, 'difficile')
    expect(intent.type).toBe('discard')
    if (intent.type !== 'discard') {
      return
    }
    expect(validateEcart(hand, intent.cards, 6).ok).toBe(true)
    // Clubs and diamonds emptied: two voids, the lone queen and cavalier banked.
    for (const card of ['clubs-3', 'clubs-q', 'diamonds-2', 'diamonds-5', 'diamonds-c']) {
      expect(intent.cards).toContain(c(card))
    }
  })
})
