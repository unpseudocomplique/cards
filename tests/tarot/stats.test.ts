import { beforeAll, describe, expect, it } from 'vitest'
import { analyzeHand, extractDealStats } from '../../shared/tarot/stats'
import { computePlayerStats, type StatsDealInput, type StatsMatchInput } from '../../shared/tarot/statsAggregate'
import { toPublicView } from '../../shared/tarot/publicView'
import type { CardId } from '../../shared/tarot/types'
import { finalRanks } from '../../server/utils/tarotStatsRecorder'
import { simulateMatch } from './fixtures/statsSim'

const ALICE = { id: 'user:alice', name: 'Alice' }
const BOB = { id: 'user:bob', name: 'Bob' }

describe('deal statistics record', () => {
  it('describes a hand', () => {
    const hand = ['trump-21', 'trump-1', 'trump-5', 'excuse', 'hearts-k', 'hearts-q', 'hearts-2', 'spades-k'] as CardId[]
    const profile = analyzeHand(hand)
    expect(profile.trumps).toBe(3)
    expect(profile.bouts).toBe(3)
    expect(profile.kings).toBe(2)
    expect(profile.queens).toBe(1)
    expect(profile.longestSuit).toBe(3)
    expect(profile.voids).toBe(2)
    expect(profile.singletons).toBe(1)
    expect(profile.petit && profile.vingtEtUn && profile.excuse).toBe(true)
  })

  it.each([3, 4, 5] as const)('records every scored deal at %i players, consistent with the score', (playerCount) => {
    const { records, final } = simulateMatch({ people: [ALICE, BOB], playerCount, deals: 6, seed: 4242 + playerCount })
    expect(records.length).toBeGreaterThan(0)
    for (const record of records) {
      expect(record.seats).toHaveLength(playerCount)
      const taker = record.seats[record.takerSeat]!
      expect(taker.role).toBe('taker')
      expect(taker.won).toBe(record.success)
      expect(taker.bid).toBe(record.contract)
      // Zero-sum deal, every seat has the hand it was dealt.
      expect(record.seats.reduce((total, seat) => total + seat.delta, 0)).toBeCloseTo(0)
      const handSize = playerCount === 3 ? 24 : playerCount === 4 ? 18 : 15
      for (const seat of record.seats) {
        expect(seat.position).toBeGreaterThanOrEqual(1)
        expect(seat.position).toBeLessThanOrEqual(playerCount)
        expect(seat.hand.trumps + seat.hand.longestSuit).toBeLessThanOrEqual(handSize)
        expect(seat.won).toBe((seat.role !== 'defender') === record.success)
      }
      expect(record.seats[record.dealerSeat]!.position).toBe(playerCount)
      expect(record.seats[0]!.userId).toBe(ALICE.id)
      expect(record.seats[2]!.userId).toBeNull()
      expect(record.seats[2]!.isBot).toBe(true)
    }
    const totals = final.scores
    const summed = final.scores.map((_, seat) => records.reduce((total, record) => total + record.seats[seat]!.delta, 0))
    expect(summed).toEqual(totals)
  })

  it('keeps the dealt hands secret', () => {
    const { final } = simulateMatch({ people: [ALICE], playerCount: 4, deals: 1, seed: 7 })
    expect(JSON.stringify(toPublicView(final))).not.toContain('dealtHands')
  })

  it('returns null outside of a scored deal', () => {
    const { final } = simulateMatch({ people: [ALICE], playerCount: 4, deals: 1, seed: 9 })
    expect(extractDealStats(final)).toBeNull()
  })
})

describe('player statistics', () => {
  let cached: { deals: StatsDealInput[], matches: StatsMatchInput[] }
  beforeAll(() => {
    cached = buildHistory()
  })
  const history = () => cached

  function buildHistory() {
    const deals: StatsDealInput[] = []
    const matches: StatsMatchInput[] = []
    let day = 0
    for (let match = 0; match < 8; match++) {
      const playerCount = ([3, 4, 5] as const)[match % 3]!
      const { records, final } = simulateMatch({ people: [ALICE, BOB], playerCount, deals: 5, seed: 1000 + match * 37 })
      const matchId = `m${match}`
      for (const record of records) {
        deals.push({ matchId, playedAt: new Date(Date.UTC(2026, 9, 1 + day++)).toISOString(), withBots: true, record })
      }
      const ranks = finalRanks(final.scores)
      matches.push({
        matchId,
        finishedAt: new Date(Date.UTC(2026, 9, day)).toISOString(),
        playerCount,
        withBots: true,
        players: final.seats.map((seat, index) => ({ userId: seat.userId?.startsWith('bot:') ? null : seat.userId, name: seat.name, isBot: Boolean(seat.userId?.startsWith('bot:')), score: final.scores[index]!, rank: ranks[index]! }))
      })
    }
    return { deals, matches }
  }

  it('adds up the deals of a player', () => {
    const { deals, matches } = history()
    const stats = computePlayerStats(ALICE.id, deals, matches)
    const mine = deals.map(deal => deal.record.seats.find(seat => seat.userId === ALICE.id)!)
    expect(stats.summary.deals).toBe(deals.length)
    expect(stats.summary.totalDelta).toBe(mine.reduce((total, seat) => total + seat.delta, 0))
    expect(stats.summary.takes).toBe(mine.filter(seat => seat.role === 'taker').length)
    expect(stats.contracts.reduce((total, contract) => total + contract.taken, 0)).toBe(stats.summary.takes)
    expect(stats.situations.bouts.reduce((total, bucket) => total + bucket.deals, 0)).toBe(deals.length)
    expect(stats.situations.strength.reduce((total, bucket) => total + bucket.takes, 0)).toBe(stats.summary.takes)
    expect(stats.situations.matrix.flatMap(row => row.cells).reduce((total, cell) => total + cell.deals, 0)).toBe(deals.length)
    expect(stats.situations.playerCount.map(bucket => bucket.key)).toEqual(['p3', 'p4', 'p5'])
    expect(stats.situations.position.at(-1)!.label).toBe('Donneur')
    expect(stats.timeline).toHaveLength(deals.length)
    expect(stats.timeline.at(-1)!.cumulative).toBe(stats.summary.totalDelta)
    expect(stats.summary.matches).toBe(8)
    expect(stats.periods.reduce((total, period) => total + period.deals, 0)).toBe(deals.length)
    expect(stats.roles.taker.deals + stats.roles.partner.deals + stats.roles.defender.deals).toBe(deals.length)
    expect(stats.tables.withBots.deals).toBe(deals.length)
    expect(stats.tables.humansOnly.deals).toBe(0)
  })

  it('compares with the people played with', () => {
    const { deals, matches } = history()
    const stats = computePlayerStats(ALICE.id, deals, matches, [{ userId: BOB.id, name: 'Bob', deals: 99, takes: 20, takesWon: 12, totalDelta: 300, matches: 9, matchesWon: 3 }])
    expect(stats.friends).toHaveLength(1)
    const bob = stats.friends[0]!
    expect(bob.userId).toBe(BOB.id)
    expect(bob.dealsTogether).toBe(deals.length)
    expect(bob.matchesTogether).toBe(8)
    expect(bob.matchesAhead + bob.matchesBehind).toBeLessThanOrEqual(8)
    expect(bob.theirDelta).toBe(deals.reduce((total, deal) => total + deal.record.seats[1]!.delta, 0))
    expect(bob.global?.deals).toBe(99)
    // Bob and Alice never both defend against a bot taker as partners at 3-4 players.
    expect(bob.sameCamp).toBeLessThanOrEqual(stats.roles.taker.deals + stats.roles.partner.deals)
  })

  it('handles a player with no deal', () => {
    const stats = computePlayerStats('user:nobody', [], [])
    expect(stats.summary.deals).toBe(0)
    expect(stats.summary.takeSuccessRate).toBe(0)
    expect(stats.feats.biggestWin).toBeNull()
    expect(stats.friends).toEqual([])
  })

  it('shares places on equal scores', () => {
    expect(finalRanks([120, -40, 120, -200])).toEqual([1, 3, 1, 4])
  })
})
