import { describe, expect, it } from 'vitest'
import { apply } from '../../shared/tarot/apply'
import { chooseBotIntent } from '../../shared/tarot/botPolicy'
import { createEmptyGame } from '../../shared/tarot/createGame'
import type { BotLevel, GameState, PlayerCount } from '../../shared/tarot/types'
import { chooseBotIntent as legacyBotIntent } from './fixtures/legacyBot'

/** 'ancien' = the bot before the levels existed, kept to measure progress. */
type SimLevel = BotLevel | 'ancien'

const HOST = 'user:host'

/** A table of bots only, with a level per seat, dealt from `seed`. */
function botTable(simLevels: SimLevel[], seed: number): GameState {
  const levels = simLevels.map(level => (level === 'ancien' ? 'moyen' : level))
  let state = createEmptyGame({
    hostUserId: HOST,
    playerCount: levels.length as PlayerCount,
    endMode: 'deals',
    endValue: 1,
    deckId: 'deck-test'
  })
  // The host seat becomes a bot too.
  state = {
    ...state,
    seats: state.seats.map((seat, index) => index === 0
      ? { ...seat, userId: 'bot:1', name: 'Bot 1', controlledBy: 'bot' as const, botLevel: levels[0] }
      : seat),
    hostUserId: HOST
  }
  for (let i = 1; i < levels.length; i++) {
    const added = apply(state, { type: 'addBot', level: levels[i] }, { userId: HOST })
    if (!added.ok) {
      throw new Error(added.reason)
    }
    state = added.state
  }
  state = { ...state, rngCounter: seed, dealerSeat: seed % levels.length }
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

/** Plays one deal to the end; null when everybody passed. */
export function playDeal(levels: SimLevel[], seed: number): GameState | null {
  let state = botTable(levels, seed)
  for (let steps = 0; steps < 500; steps++) {
    if (state.phase === 'Scoring') {
      return state
    }
    const seat = actingSeat(state)
    const intent = levels[seat] === 'ancien' ? legacyBotIntent(state, seat) : chooseBotIntent(state, seat)
    const result = apply(state, intent, { userId: state.seats[seat]!.userId!, seat })
    if (!result.ok) {
      throw new Error(`${intent.type} ${JSON.stringify(intent)} rejected: ${result.reason}`)
    }
    if (result.events.some(event => event.type === 'redeal' && event.reason === 'all_pass')) {
      return null
    }
    state = result.state
  }
  throw new Error('deal did not finish')
}

describe('bot simulation', () => {
  it.each([3, 4, 5] as const)('plays full legal deals at %i players for every level', (count) => {
    const levels: BotLevel[] = ['facile', 'moyen', 'difficile', 'moyen', 'difficile'].slice(0, count) as BotLevel[]
    let finished = 0
    for (let seed = 1; seed <= 6; seed++) {
      const end = playDeal(levels, seed * 7919)
      if (end) {
        finished++
        expect(end.lastDeltas).toBeDefined()
        const total = Object.values(end.lastDeltas!).reduce((a, b) => a + b, 0)
        expect(Math.abs(total)).toBeLessThan(1e-9)
      }
    }
    expect(finished).toBeGreaterThan(0)
  }, 60_000)

  // Strength benchmark: BOT_SIM=200 pnpm vitest run tests/tarot/botSimulation.test.ts
  const deals = Number(process.env.BOT_SIM ?? 0)
  it.runIf(deals > 0)('benchmark: stronger levels score more on the same deals', () => {
    const pairs: Array<[SimLevel, SimLevel]> = [['difficile', 'ancien'], ['moyen', 'ancien'], ['facile', 'ancien'], ['difficile', 'moyen'], ['moyen', 'facile']]
    for (const count of (process.env.BOT_SIM_PLAYERS ?? '4,5,3').split(',').map(Number) as PlayerCount[]) {
      for (const [strong, weak] of pairs) {
        let strongTotal = 0
        let weakTotal = 0
        let played = 0
        const takes = { strong: 0, weak: 0 }
        const wins = { strong: 0, weak: 0 }
        for (let seed = 1; seed <= deals; seed++) {
          // Duplicate: the same deal twice, levels swapped between seats.
          for (const flip of [false, true]) {
            const levels = Array.from({ length: count }, (_, i) => ((i % 2 === 0) !== flip ? strong : weak))
            const end = playDeal(levels, seed * 104729 + count)
            if (!end) {
              continue
            }
            played++
            for (let s = 0; s < count; s++) {
              const delta = end.lastDeltas![s] ?? 0
              if (levels[s] === strong) {
                strongTotal += delta
              } else {
                weakTotal += delta
              }
            }
            const takerLevel = levels[end.bid!.seat] === strong ? 'strong' : 'weak'
            takes[takerLevel]++
            if ((end.lastDeltas![end.bid!.seat] ?? 0) > 0) {
              wins[takerLevel]++
            }
          }
        }
        const strongSeats = Math.ceil(count / 2)
        const weakSeats = count - strongSeats
        process.stdout.write(`${count}p ${strong} vs ${weak}: ${played} deals, avg/seat/deal ${strong} ${(strongTotal / played / strongSeats).toFixed(1)} · ${weak} ${(weakTotal / played / weakSeats).toFixed(1)} | takes ${takes.strong}/${takes.weak} won ${wins.strong}/${wins.weak}\n`)
      }
    }
  }, 600_000)
})
