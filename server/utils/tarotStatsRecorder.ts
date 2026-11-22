import { sql } from 'drizzle-orm'
import { db, tarotDealPlayers, tarotDeals, tarotMatches, tarotMatchPlayers } from '../database'
import type { TarotMatchSeat } from '../database/schema'
import type { GameEvent, GameState } from '../../shared/tarot'
import { extractDealStats, isBotUserId } from '../../shared/tarot/stats'

/**
 * Keeps every scored deal and finished match in the database for the
 * statistics page. Writes of one match run one after the other (the match row
 * must exist before its deals); a failure is logged and never reaches the table.
 */

const queues = new Map<string, Promise<void>>()

function enqueue(matchId: string, task: () => Promise<void>): Promise<void> {
  const previous = queues.get(matchId) ?? Promise.resolve()
  const next = previous
    .then(task)
    .catch((error) => {
      console.error(`[stats] match ${matchId}: could not save statistics`, error)
    })
  queues.set(matchId, next)
  void next.finally(() => {
    if (queues.get(matchId) === next) {
      queues.delete(matchId)
    }
  })
  return next
}

function matchSeats(state: GameState): TarotMatchSeat[] {
  return state.seats.slice(0, state.playerCount).map(seat => ({
    seat: seat.seatId,
    userId: isBotUserId(seat.userId) ? null : seat.userId,
    name: seat.name,
    isBot: isBotUserId(seat.userId),
    ...(seat.botLevel && isBotUserId(seat.userId) ? { botLevel: seat.botLevel } : {})
  }))
}

function hasBots(state: GameState): boolean {
  return state.seats.slice(0, state.playerCount).some(seat => isBotUserId(seat.userId))
}

export function recordDeal(matchId: string, code: string, state: GameState): Promise<void> | null {
  const record = extractDealStats(state)
  if (!record) {
    return null
  }
  const withBots = hasBots(state)
  const humans = record.seats.filter(seat => seat.userId)
  return enqueue(matchId, async () => {
    await db.insert(tarotMatches).values({
      id: matchId,
      code,
      hostUserId: isBotUserId(state.hostUserId) ? null : state.hostUserId,
      deckId: state.deckId,
      playerCount: state.playerCount,
      endMode: state.endMode,
      endValue: state.endValue,
      withBots,
      seats: matchSeats(state)
    }).onConflictDoNothing()

    const [deal] = await db.insert(tarotDeals).values({
      matchId,
      dealIndex: record.dealIndex,
      playerCount: record.playerCount,
      withBots,
      contract: record.contract,
      success: record.success,
      record
    }).onConflictDoNothing().returning({ id: tarotDeals.id, playedAt: tarotDeals.playedAt })
    if (!deal) {
      return
    }

    if (humans.length) {
      await db.insert(tarotDealPlayers).values(humans.map(seat => ({
        dealId: deal.id,
        matchId,
        userId: seat.userId!,
        seat: seat.seat,
        role: seat.role,
        bid: seat.bid,
        won: seat.won,
        delta: Math.round(seat.delta),
        playerCount: record.playerCount,
        withBots,
        playedAt: deal.playedAt
      }))).onConflictDoNothing()
    }

    await db.update(tarotMatches)
      .set({ dealCount: sql`${tarotMatches.dealCount} + 1` })
      .where(sql`${tarotMatches.id} = ${matchId}`)
  })
}

/** Final places: 1 = best score; equal scores share the place. */
export function finalRanks(scores: number[]): number[] {
  return scores.map(score => 1 + scores.filter(other => other > score).length)
}

export function recordMatchEnd(matchId: string, state: GameState): Promise<void> {
  const scores = state.scores.slice(0, state.playerCount).map(score => Math.round(score))
  const ranks = finalRanks(scores)
  return enqueue(matchId, async () => {
    const [match] = await db.update(tarotMatches)
      .set({ finishedAt: new Date(), finalScores: scores })
      .where(sql`${tarotMatches.id} = ${matchId}`)
      .returning({ id: tarotMatches.id, finishedAt: tarotMatches.finishedAt })
    if (!match) {
      // No deal was ever scored: nothing to keep.
      return
    }
    const people = state.seats.slice(0, state.playerCount).filter(seat => !isBotUserId(seat.userId))
    if (people.length) {
      await db.insert(tarotMatchPlayers).values(people.map(seat => ({
        matchId,
        userId: seat.userId!,
        seat: seat.seatId,
        score: scores[seat.seatId] ?? 0,
        rank: ranks[seat.seatId] ?? 1,
        finishedAt: match.finishedAt ?? new Date()
      }))).onConflictDoNothing()
    }
  })
}

export function handleGameEvents(info: { code: string, matchId: string, state: GameState, events: GameEvent[] }): void {
  for (const event of info.events) {
    if (event.type === 'dealScored') {
      void recordDeal(info.matchId, info.code, info.state)
    } else if (event.type === 'matchOver') {
      void recordMatchEnd(info.matchId, info.state)
    }
  }
}
