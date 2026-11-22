import { and, eq, gte, inArray, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { db, tarotDealPlayers, tarotDeals, tarotMatches, tarotMatchPlayers, users } from '~~/server/utils/db'
import { computePlayerStats, type GlobalPlayerTotals, type StatsMatchInput } from '~~/shared/tarot/statsAggregate'
import { isBotUserId } from '~~/shared/tarot/stats'

const querySchema = z.object({
  period: z.enum(['all', '30', '90', '365']).default('all'),
  players: z.enum(['all', '3', '4', '5']).default('all'),
  tables: z.enum(['all', 'humans', 'bots']).default('all')
})

/** Everything the statistics page shows for the signed-in player. */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event) as { user: { id: string } }
  const userId = session.user.id
  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ status: 400, message: 'Filtres invalides' })
  }
  const filters = parsed.data
  const since = filters.period === 'all' ? null : new Date(Date.now() - Number(filters.period) * 86_400_000)

  const playerFilters = (table: typeof tarotDealPlayers) => {
    const conditions: SQL[] = []
    if (since) {
      conditions.push(gte(table.playedAt, since))
    }
    if (filters.players !== 'all') {
      conditions.push(eq(table.playerCount, Number(filters.players)))
    }
    if (filters.tables !== 'all') {
      conditions.push(eq(table.withBots, filters.tables === 'bots'))
    }
    return conditions
  }

  const dealRows = await db
    .select({
      matchId: tarotDeals.matchId,
      playedAt: tarotDeals.playedAt,
      withBots: tarotDeals.withBots,
      record: tarotDeals.record
    })
    .from(tarotDealPlayers)
    .innerJoin(tarotDeals, eq(tarotDeals.id, tarotDealPlayers.dealId))
    .where(and(eq(tarotDealPlayers.userId, userId), ...playerFilters(tarotDealPlayers)))
    .orderBy(tarotDealPlayers.playedAt)
    .limit(20_000)

  const matchConditions: SQL[] = [eq(tarotMatchPlayers.userId, userId)]
  if (since) {
    matchConditions.push(gte(tarotMatchPlayers.finishedAt, since))
  }
  if (filters.players !== 'all') {
    matchConditions.push(eq(tarotMatches.playerCount, Number(filters.players)))
  }
  if (filters.tables !== 'all') {
    matchConditions.push(eq(tarotMatches.withBots, filters.tables === 'bots'))
  }
  const myMatchRows = await db
    .select({
      matchId: tarotMatches.id,
      finishedAt: tarotMatches.finishedAt,
      playerCount: tarotMatches.playerCount,
      withBots: tarotMatches.withBots,
      seats: tarotMatches.seats,
      finalScores: tarotMatches.finalScores
    })
    .from(tarotMatchPlayers)
    .innerJoin(tarotMatches, eq(tarotMatches.id, tarotMatchPlayers.matchId))
    .where(and(...matchConditions))

  const matches: StatsMatchInput[] = myMatchRows.map((row) => {
    const scores = row.finalScores ?? []
    return {
      matchId: row.matchId,
      finishedAt: (row.finishedAt ?? new Date()).toISOString(),
      playerCount: row.playerCount,
      withBots: row.withBots,
      players: row.seats.map(seat => ({
        userId: seat.userId,
        name: seat.name,
        isBot: seat.isBot,
        score: scores[seat.seat] ?? 0,
        rank: 1 + scores.filter(other => other > (scores[seat.seat] ?? 0)).length
      }))
    }
  })

  // People played with: their own totals over the same filters.
  const friendIds = new Set<string>()
  for (const row of dealRows) {
    for (const seat of row.record.seats) {
      if (seat.userId && seat.userId !== userId && !isBotUserId(seat.userId)) {
        friendIds.add(seat.userId)
      }
    }
  }
  const ids = [...friendIds].slice(0, 200)
  const globals: GlobalPlayerTotals[] = []
  if (ids.length) {
    const totals = await db
      .select({
        userId: tarotDealPlayers.userId,
        deals: sql<number>`count(*)::int`,
        takes: sql<number>`count(*) filter (where ${tarotDealPlayers.role} = 'taker')::int`,
        takesWon: sql<number>`count(*) filter (where ${tarotDealPlayers.role} = 'taker' and ${tarotDealPlayers.won})::int`,
        totalDelta: sql<number>`coalesce(sum(${tarotDealPlayers.delta}), 0)::int`
      })
      .from(tarotDealPlayers)
      .where(and(inArray(tarotDealPlayers.userId, ids), ...playerFilters(tarotDealPlayers)))
      .groupBy(tarotDealPlayers.userId)
    const matchTotals = await db
      .select({
        userId: tarotMatchPlayers.userId,
        matches: sql<number>`count(*)::int`,
        matchesWon: sql<number>`count(*) filter (where ${tarotMatchPlayers.rank} = 1)::int`
      })
      .from(tarotMatchPlayers)
      .where(and(inArray(tarotMatchPlayers.userId, ids), ...(since ? [gte(tarotMatchPlayers.finishedAt, since)] : [])))
      .groupBy(tarotMatchPlayers.userId)
    const people = await db
      .select({ id: users.id, username: users.username, picture: users.picture })
      .from(users)
      .where(inArray(users.id, ids))
    const peopleById = new Map(people.map(person => [person.id, person]))
    const matchesById = new Map(matchTotals.map(row => [row.userId, row]))
    for (const row of totals) {
      const person = peopleById.get(row.userId)
      globals.push({
        ...row,
        name: person?.username ?? '',
        picture: person?.picture ?? null,
        matches: matchesById.get(row.userId)?.matches ?? 0,
        matchesWon: matchesById.get(row.userId)?.matchesWon ?? 0
      })
    }
  }

  const stats = computePlayerStats(
    userId,
    dealRows.map(row => ({ matchId: row.matchId, playedAt: row.playedAt.toISOString(), withBots: row.withBots, record: row.record })),
    matches,
    globals
  )
  return { filters, stats }
})
