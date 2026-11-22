import { apply } from '../../../shared/tarot/apply'
import { chooseBotIntent } from '../../../shared/tarot/botPolicy'
import { createEmptyGame } from '../../../shared/tarot/createGame'
import { extractDealStats, type DealStatsRecord } from '../../../shared/tarot/stats'
import type { GameState, PlayerCount } from '../../../shared/tarot/types'

/**
 * A match where bots play every seat; `people` seats get a person's id so the
 * statistics treat them as people (they show as on autopilot).
 */
export function simulateMatch(options: {
  people: Array<{ id: string, name: string }>
  playerCount: PlayerCount
  deals: number
  seed: number
}): { records: DealStatsRecord[], final: GameState } {
  const { people, playerCount, deals, seed } = options
  let state = createEmptyGame({ hostUserId: 'bot:1', playerCount, endMode: 'deals', endValue: deals, deckId: 'deck-test' })
  state = {
    ...state,
    seats: state.seats.map((seat, index) => index === 0
      ? { ...seat, userId: 'bot:1', name: 'Bot 1', connected: true, controlledBy: 'bot' as const, botLevel: 'facile' as const }
      : seat)
  }
  for (let i = 1; i < playerCount; i++) {
    const added = apply(state, { type: 'addBot', level: 'facile' }, { userId: 'bot:1' })
    if (!added.ok) {
      throw new Error(added.reason)
    }
    state = added.state
  }
  state = {
    ...state,
    seats: state.seats.map((seat, index) => people[index]
      ? { ...seat, userId: people[index]!.id, name: people[index]!.name }
      : seat),
    hostUserId: people[0]?.id ?? 'bot:1',
    rngCounter: seed,
    dealerSeat: seed % playerCount
  }
  const started = apply(state, { type: 'start' }, { userId: state.hostUserId })
  if (!started.ok) {
    throw new Error(started.reason)
  }
  state = started.state
  const records: DealStatsRecord[] = []
  for (let steps = 0; steps < 20_000; steps++) {
    if (state.phase === 'MatchOver') {
      return { records, final: state }
    }
    let seat = state.currentSeat
    if (state.playerCount === 5 && state.bid && !state.calledKing && (state.phase === 'DogEcarta' || state.phase === 'ReadyToPlay')) {
      seat = state.bid.seat
    }
    const intent = state.phase === 'Scoring' ? { type: 'continue' as const } : chooseBotIntent(state, seat)
    const actor = state.phase === 'Scoring' ? { userId: state.hostUserId } : { userId: state.seats[seat]!.userId!, seat }
    const result = apply(state, intent, actor)
    if (!result.ok) {
      throw new Error(`${intent.type} rejected: ${result.reason}`)
    }
    state = result.state
    if (result.events.some(event => event.type === 'dealScored')) {
      const record = extractDealStats(state)
      if (!record) {
        throw new Error('no record for a scored deal')
      }
      records.push(record)
    }
  }
  throw new Error('match did not finish')
}
