import type { Contract } from './bid'
import type { DealRole, DealSeatStats, DealStatsRecord } from './stats'

/**
 * Turn the stored deal records of one player into everything the statistics
 * page shows. Pure, so it runs the same in tests and on the server.
 */

export type StatsDealInput = {
  matchId: string
  /** ISO date. */
  playedAt: string
  withBots: boolean
  record: DealStatsRecord
}

export type StatsMatchInput = {
  matchId: string
  finishedAt: string
  playerCount: number
  withBots: boolean
  players: Array<{ userId: string | null, name: string, isBot: boolean, score: number, rank: number }>
}

/** Totals of a player over all their deals, for the friends board. */
export type GlobalPlayerTotals = {
  userId: string
  name: string
  picture?: string | null
  deals: number
  takes: number
  takesWon: number
  totalDelta: number
  matches: number
  matchesWon: number
}

export type Tally = {
  deals: number
  won: number
  /** won / deals, 0..1 (0 when no deal). */
  rate: number
  totalDelta: number
  avgDelta: number
}

export type SituationBucket = {
  key: string
  label: string
  deals: number
  takes: number
  takeRate: number
  takesWon: number
  successRate: number
  avgDelta: number
  /** What the player said in that situation, counts. */
  bids: Record<Contract | 'passe', number>
  /** The bid most often said there. */
  usualBid: Contract | 'passe' | null
}

export type ContractStats = {
  contract: Contract
  taken: number
  won: number
  successRate: number
  avgDiff: number
  avgDelta: number
  bestDelta: number
  /** Average hand when taking this contract (as dealt). */
  avgTrumps: number
  avgBouts: number
  avgPoints: number
}

export type DealHighlight = {
  playedAt: string
  delta: number
  role: DealRole
  contract: Contract
  success: boolean
  diff: number
  playerCount: number
  takerName: string
}

export type TimelinePoint = {
  playedAt: string
  delta: number
  cumulative: number
  role: DealRole
  /** Success rate of the last 10 takes (null before the first take). */
  rollingTakeRate: number | null
  /** Average points of the last 20 deals. */
  rollingAvg: number
}

export type PeriodStats = {
  key: string
  label: string
  deals: number
  takes: number
  takesWon: number
  successRate: number
  totalDelta: number
  avgDelta: number
  matches: number
  matchesWon: number
}

export type FriendStats = {
  userId: string
  name: string
  picture?: string | null
  dealsTogether: number
  matchesTogether: number
  /** Matches where you finished ahead of them / they finished ahead of you. */
  matchesAhead: number
  matchesBehind: number
  /** On the deals played together. */
  yourDelta: number
  theirDelta: number
  theirTakes: number
  theirTakesWon: number
  /** They took and you defended: how often they made it. */
  theirTakesAgainstYou: number
  theirTakesAgainstYouWon: number
  /** You took and they defended. */
  yourTakesAgainstThem: number
  yourTakesAgainstThemWon: number
  /** Same camp (5 players, called partner). */
  sameCamp: number
  sameCampWon: number
  global?: GlobalPlayerTotals
}

export type PlayerStats = {
  summary: {
    deals: number
    matches: number
    matchesWon: number
    matchWinRate: number
    avgRank: number | null
    takes: number
    takeRate: number
    takesWon: number
    takeSuccessRate: number
    totalDelta: number
    avgDelta: number
    dealsWon: number
    dealWinRate: number
    longestWinStreak: number
    currentStreak: { kind: 'won' | 'lost' | null, length: number }
    avgTakerDiff: number
    firstPlayedAt: string | null
    lastPlayedAt: string | null
  }
  roles: Record<DealRole, Tally>
  contracts: ContractStats[]
  bidding: {
    spoken: Record<Contract | 'passe', number>
    overcalls: number
    /** Passed with 56 points or more. */
    strongPasses: number
    /** Took with less than 40 points. */
    boldTakes: number
    avgPointsWhenTaking: number
    avgPointsWhenPassing: number
  }
  situations: {
    bouts: SituationBucket[]
    trumps: SituationBucket[]
    strength: SituationBucket[]
    position: SituationBucket[]
    playerCount: SituationBucket[]
    /** Rows = bouts 0..3, columns = strength buckets. */
    matrix: Array<{ bouts: number, cells: SituationBucket[] }>
  }
  partner: {
    called: number
    calledWon: number
    calledSelf: number
    calledSelfWon: number
  }
  feats: {
    petitAuBout: number
    petitLost: number
    poignees: { simple: number, double: number, triple: number }
    chelemsMade: number
    chelemsAnnounced: number
    chelemsDefended: number
    gardeContreMade: number
    gardeSansMade: number
    biggestWin: DealHighlight | null
    worstLoss: DealHighlight | null
    biggestDiff: DealHighlight | null
  }
  timeline: TimelinePoint[]
  periods: PeriodStats[]
  periodUnit: 'week' | 'month'
  matches: Array<{ matchId: string, finishedAt: string, playerCount: number, rank: number, score: number, players: number, withBots: boolean }>
  tables: { humansOnly: Tally & { takes: number, takeSuccessRate: number }, withBots: Tally & { takes: number, takeSuccessRate: number } }
  friends: FriendStats[]
}

const CONTRACTS: Contract[] = ['prise', 'garde', 'garde_sans', 'garde_contre']
const BIDS: Array<Contract | 'passe'> = ['passe', ...CONTRACTS]

export const STRENGTH_BUCKETS = [
  { key: 's0', label: '< 40', min: -Infinity, max: 39 },
  { key: 's1', label: '40 – 55', min: 40, max: 55 },
  { key: 's2', label: '56 – 70', min: 56, max: 70 },
  { key: 's3', label: '71 – 80', min: 71, max: 80 },
  { key: 's4', label: '81 +', min: 81, max: Infinity }
] as const

export const TRUMP_BUCKETS = [
  { key: 't0', label: '0 – 3', min: 0, max: 3 },
  { key: 't1', label: '4 – 5', min: 4, max: 5 },
  { key: 't2', label: '6 – 7', min: 6, max: 7 },
  { key: 't3', label: '8 – 9', min: 8, max: 9 },
  { key: 't4', label: '10 +', min: 10, max: Infinity }
] as const

const rate = (num: number, den: number) => (den ? num / den : 0)
const avg = (total: number, count: number) => (count ? Math.round((total / count) * 10) / 10 : 0)

function emptyBids(): Record<Contract | 'passe', number> {
  return { passe: 0, prise: 0, garde: 0, garde_sans: 0, garde_contre: 0 }
}

type Acc = { deals: number, takes: number, takesWon: number, delta: number, bids: Record<Contract | 'passe', number> }
const newAcc = (): Acc => ({ deals: 0, takes: 0, takesWon: 0, delta: 0, bids: emptyBids() })

function addTo(acc: Acc, me: DealSeatStats) {
  acc.deals++
  acc.delta += me.delta
  if (me.role === 'taker') {
    acc.takes++
    if (me.won) {
      acc.takesWon++
    }
  }
  acc.bids[me.bid ?? 'passe']++
}

function toBucket(key: string, label: string, acc: Acc): SituationBucket {
  let usualBid: Contract | 'passe' | null = null
  let top = 0
  for (const bid of BIDS) {
    if (acc.bids[bid] > top) {
      top = acc.bids[bid]
      usualBid = bid
    }
  }
  return {
    key,
    label,
    deals: acc.deals,
    takes: acc.takes,
    takeRate: rate(acc.takes, acc.deals),
    takesWon: acc.takesWon,
    successRate: rate(acc.takesWon, acc.takes),
    avgDelta: avg(acc.delta, acc.deals),
    bids: acc.bids,
    usualBid
  }
}

function tally(deals: number, won: number, totalDelta: number): Tally {
  return { deals, won, rate: rate(won, deals), totalDelta, avgDelta: avg(totalDelta, deals) }
}

function strengthKey(points: number) {
  return STRENGTH_BUCKETS.find(bucket => points >= bucket.min && points <= bucket.max)!.key
}

function trumpKey(trumps: number) {
  return TRUMP_BUCKETS.find(bucket => trumps >= bucket.min && trumps <= bucket.max)!.key
}

function positionKey(me: DealSeatStats, playerCount: number) {
  return me.position === playerCount ? 'D' : String(me.position)
}

function positionLabel(key: string) {
  if (key === 'D') {
    return 'Donneur'
  }
  return key === '1' ? '1er à parler' : `${key}e à parler`
}

function isoWeekKey(date: Date): { key: string, label: string } {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = day.getUTCDay() || 7
  day.setUTCDate(day.getUTCDate() + 4 - weekday)
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  const monday = new Date(date)
  monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() || 7) - 1))
  const label = monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return { key: `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, label }
}

function monthKey(date: Date): { key: string, label: string } {
  const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  const label = date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  return { key, label }
}

function highlight(deal: StatsDealInput, me: DealSeatStats): DealHighlight {
  const record = deal.record
  return {
    playedAt: deal.playedAt,
    delta: me.delta,
    role: me.role,
    contract: record.contract,
    success: record.success,
    diff: record.diff,
    playerCount: record.playerCount,
    takerName: record.seats[record.takerSeat]?.name ?? ''
  }
}

export function computePlayerStats(
  userId: string,
  dealInputs: StatsDealInput[],
  matchInputs: StatsMatchInput[],
  globals: GlobalPlayerTotals[] = []
): PlayerStats {
  const deals = [...dealInputs]
    .map(deal => ({ deal, me: deal.record.seats.find(seat => seat.userId === userId) }))
    .filter((entry): entry is { deal: StatsDealInput, me: DealSeatStats } => Boolean(entry.me))
    .sort((a, b) => a.deal.playedAt.localeCompare(b.deal.playedAt))

  const roles: Record<DealRole, { deals: number, won: number, delta: number }> = {
    taker: { deals: 0, won: 0, delta: 0 },
    partner: { deals: 0, won: 0, delta: 0 },
    defender: { deals: 0, won: 0, delta: 0 }
  }
  const contractAcc = new Map<Contract, { taken: number, won: number, diff: number, delta: number, best: number, trumps: number, bouts: number, points: number }>()
  const spoken = emptyBids()
  let overcalls = 0
  let strongPasses = 0
  let boldTakes = 0
  let takePoints = 0
  let passPoints = 0
  let passCount = 0
  let takerDiff = 0

  const boutsAcc = [0, 1, 2, 3].map(() => newAcc())
  const trumpAcc = new Map(TRUMP_BUCKETS.map(bucket => [bucket.key as string, newAcc()]))
  const strengthAcc = new Map(STRENGTH_BUCKETS.map(bucket => [bucket.key as string, newAcc()]))
  const positionAcc = new Map<string, Acc>()
  const countAcc = new Map<number, Acc>()
  const matrixAcc = [0, 1, 2, 3].map(() => new Map(STRENGTH_BUCKETS.map(bucket => [bucket.key as string, newAcc()])))

  const partner = { called: 0, calledWon: 0, calledSelf: 0, calledSelfWon: 0 }
  const feats: PlayerStats['feats'] = {
    petitAuBout: 0,
    petitLost: 0,
    poignees: { simple: 0, double: 0, triple: 0 },
    chelemsMade: 0,
    chelemsAnnounced: 0,
    chelemsDefended: 0,
    gardeContreMade: 0,
    gardeSansMade: 0,
    biggestWin: null,
    worstLoss: null,
    biggestDiff: null
  }
  const tables = {
    humansOnly: { deals: 0, won: 0, delta: 0, takes: 0, takesWon: 0 },
    withBots: { deals: 0, won: 0, delta: 0, takes: 0, takesWon: 0 }
  }

  const timeline: TimelinePoint[] = []
  const recentTakes: boolean[] = []
  const recentDeltas: number[] = []
  let cumulative = 0
  let dealsWon = 0
  let streak = 0
  let longestWinStreak = 0
  let lastKind: 'won' | 'lost' | null = null

  type FriendAcc = Omit<FriendStats, 'matchesTogether' | 'matchesAhead' | 'matchesBehind' | 'global'> & { matchIds: Set<string> }
  const friends = new Map<string, FriendAcc>()

  for (const { deal, me } of deals) {
    const record = deal.record
    const won = me.won
    cumulative += me.delta
    if (won) {
      dealsWon++
    }
    if (lastKind === (won ? 'won' : 'lost')) {
      streak++
    } else {
      lastKind = won ? 'won' : 'lost'
      streak = 1
    }
    if (won) {
      longestWinStreak = Math.max(longestWinStreak, streak)
    }

    roles[me.role].deals++
    roles[me.role].delta += me.delta
    if (won) {
      roles[me.role].won++
    }

    spoken[me.bid ?? 'passe']++
    const points = me.hand.points
    if (me.bid === 'passe' || me.bid === null) {
      passPoints += points
      passCount++
      if (points >= 56) {
        strongPasses++
      }
    }

    if (me.role === 'taker') {
      const acc = contractAcc.get(record.contract) ?? { taken: 0, won: 0, diff: 0, delta: 0, best: -Infinity, trumps: 0, bouts: 0, points: 0 }
      acc.taken++
      acc.diff += record.diff
      acc.delta += me.delta
      acc.best = Math.max(acc.best, me.delta)
      acc.trumps += me.hand.trumps
      acc.bouts += me.hand.bouts
      acc.points += points
      if (won) {
        acc.won++
      }
      contractAcc.set(record.contract, acc)
      takePoints += points
      takerDiff += record.diff
      if (record.overcall) {
        overcalls++
      }
      if (points < 40) {
        boldTakes++
      }
      recentTakes.push(won)
      if (recentTakes.length > 10) {
        recentTakes.shift()
      }
      if (record.calledKing) {
        if (record.calledSelf) {
          partner.calledSelf++
          if (won) {
            partner.calledSelfWon++
          }
        }
      }
      if (won && record.contract === 'garde_contre') {
        feats.gardeContreMade++
      }
      if (won && record.contract === 'garde_sans') {
        feats.gardeSansMade++
      }
      if (won && (!feats.biggestDiff || record.diff > feats.biggestDiff.diff)) {
        feats.biggestDiff = highlight(deal, me)
      }
    }
    if (me.role === 'partner') {
      partner.called++
      if (won) {
        partner.calledWon++
      }
    }

    addTo(boutsAcc[Math.min(3, me.hand.bouts)]!, me)
    addTo(trumpAcc.get(trumpKey(me.hand.trumps))!, me)
    addTo(strengthAcc.get(strengthKey(points))!, me)
    addTo(matrixAcc[Math.min(3, me.hand.bouts)]!.get(strengthKey(points))!, me)
    const posKey = positionKey(me, record.playerCount)
    if (!positionAcc.has(posKey)) {
      positionAcc.set(posKey, newAcc())
    }
    addTo(positionAcc.get(posKey)!, me)
    if (!countAcc.has(record.playerCount)) {
      countAcc.set(record.playerCount, newAcc())
    }
    addTo(countAcc.get(record.playerCount)!, me)

    if (me.petitAuBout) {
      feats.petitAuBout++
    }
    if (me.petitLost) {
      feats.petitLost++
    }
    if (me.poignee) {
      feats.poignees[me.poignee]++
    }
    if (record.chelem && me.role !== 'defender') {
      if (record.chelem === 'announced_made' || record.chelem === 'unannounced_made') {
        feats.chelemsMade++
      }
      if (record.chelem === 'announced_made' || record.chelem === 'announced_failed') {
        feats.chelemsAnnounced++
      }
    }
    if (record.chelem === 'defense' && me.role === 'defender') {
      feats.chelemsDefended++
    }
    if (me.delta > 0 && (!feats.biggestWin || me.delta > feats.biggestWin.delta)) {
      feats.biggestWin = highlight(deal, me)
    }
    if (me.delta < 0 && (!feats.worstLoss || me.delta < feats.worstLoss.delta)) {
      feats.worstLoss = highlight(deal, me)
    }

    const table = deal.withBots ? tables.withBots : tables.humansOnly
    table.deals++
    table.delta += me.delta
    if (won) {
      table.won++
    }
    if (me.role === 'taker') {
      table.takes++
      if (won) {
        table.takesWon++
      }
    }

    recentDeltas.push(me.delta)
    if (recentDeltas.length > 20) {
      recentDeltas.shift()
    }
    timeline.push({
      playedAt: deal.playedAt,
      delta: me.delta,
      cumulative,
      role: me.role,
      rollingTakeRate: recentTakes.length ? rate(recentTakes.filter(Boolean).length, recentTakes.length) : null,
      rollingAvg: avg(recentDeltas.reduce((a, b) => a + b, 0), recentDeltas.length)
    })

    // People played with.
    for (const other of record.seats) {
      if (!other.userId || other.userId === userId || other.isBot) {
        continue
      }
      let friend = friends.get(other.userId)
      if (!friend) {
        friend = {
          userId: other.userId,
          name: other.name,
          dealsTogether: 0,
          yourDelta: 0,
          theirDelta: 0,
          theirTakes: 0,
          theirTakesWon: 0,
          theirTakesAgainstYou: 0,
          theirTakesAgainstYouWon: 0,
          yourTakesAgainstThem: 0,
          yourTakesAgainstThemWon: 0,
          sameCamp: 0,
          sameCampWon: 0,
          matchIds: new Set()
        }
        friends.set(other.userId, friend)
      }
      friend.name = other.name
      friend.dealsTogether++
      friend.matchIds.add(deal.matchId)
      friend.yourDelta += me.delta
      friend.theirDelta += other.delta
      const sameCamp = (me.role === 'defender') === (other.role === 'defender')
      if (other.role === 'taker') {
        friend.theirTakes++
        if (other.won) {
          friend.theirTakesWon++
        }
        if (me.role === 'defender') {
          friend.theirTakesAgainstYou++
          if (other.won) {
            friend.theirTakesAgainstYouWon++
          }
        }
      }
      if (me.role === 'taker' && other.role === 'defender') {
        friend.yourTakesAgainstThem++
        if (won) {
          friend.yourTakesAgainstThemWon++
        }
      }
      if (sameCamp && me.role !== 'defender') {
        friend.sameCamp++
        if (won) {
          friend.sameCampWon++
        }
      }
    }
  }

  // Matches.
  const myMatches = matchInputs
    .map(match => ({ match, me: match.players.find(player => player.userId === userId) }))
    .filter((entry): entry is { match: StatsMatchInput, me: StatsMatchInput['players'][number] } => Boolean(entry.me))
    .sort((a, b) => a.match.finishedAt.localeCompare(b.match.finishedAt))
  const matchesWon = myMatches.filter(entry => entry.me.rank === 1).length
  const friendMatches = new Map<string, { together: number, ahead: number, behind: number }>()
  for (const { match, me } of myMatches) {
    for (const other of match.players) {
      if (!other.userId || other.userId === userId || other.isBot) {
        continue
      }
      const entry = friendMatches.get(other.userId) ?? { together: 0, ahead: 0, behind: 0 }
      entry.together++
      if (me.rank < other.rank) {
        entry.ahead++
      } else if (me.rank > other.rank) {
        entry.behind++
      }
      friendMatches.set(other.userId, entry)
    }
  }

  // Periods: weeks over a short span, months beyond ~4 months.
  const first = deals[0]?.deal.playedAt ?? null
  const last = deals.at(-1)?.deal.playedAt ?? null
  const spanDays = first && last ? (Date.parse(last) - Date.parse(first)) / 86_400_000 : 0
  const periodUnit: 'week' | 'month' = spanDays > 120 ? 'month' : 'week'
  const periodKey = periodUnit === 'week' ? isoWeekKey : monthKey
  const periods = new Map<string, PeriodStats>()
  const periodFor = (iso: string) => {
    const { key, label } = periodKey(new Date(iso))
    let period = periods.get(key)
    if (!period) {
      period = { key, label, deals: 0, takes: 0, takesWon: 0, successRate: 0, totalDelta: 0, avgDelta: 0, matches: 0, matchesWon: 0 }
      periods.set(key, period)
    }
    return period
  }
  for (const { deal, me } of deals) {
    const period = periodFor(deal.playedAt)
    period.deals++
    period.totalDelta += me.delta
    if (me.role === 'taker') {
      period.takes++
      if (me.won) {
        period.takesWon++
      }
    }
  }
  for (const { match, me } of myMatches) {
    const period = periodFor(match.finishedAt)
    period.matches++
    if (me.rank === 1) {
      period.matchesWon++
    }
  }
  for (const period of periods.values()) {
    period.successRate = rate(period.takesWon, period.takes)
    period.avgDelta = avg(period.totalDelta, period.deals)
  }

  const globalsById = new Map(globals.map(entry => [entry.userId, entry]))
  const friendList: FriendStats[] = [...friends.values()]
    .map(({ matchIds, ...friend }) => {
      const matches = friendMatches.get(friend.userId)
      const global = globalsById.get(friend.userId)
      return {
        ...friend,
        picture: global?.picture ?? null,
        matchesTogether: Math.max(matches?.together ?? 0, matchIds.size),
        matchesAhead: matches?.ahead ?? 0,
        matchesBehind: matches?.behind ?? 0,
        ...(global ? { global } : {})
      }
    })
    .sort((a, b) => b.dealsTogether - a.dealsTogether)

  const takes = roles.taker.deals
  const takesWon = roles.taker.won
  const totalDelta = cumulative
  const ranks = myMatches.map(entry => entry.me.rank)

  const situationBuckets = <T extends { key: string, label: string }>(defs: readonly T[], accs: Map<string, Acc>) =>
    defs.map(def => toBucket(def.key, def.label, accs.get(def.key)!))

  const positionKeys = [...positionAcc.keys()].sort((a, b) => (a === 'D' ? 99 : Number(a)) - (b === 'D' ? 99 : Number(b)))

  const tableTally = (entry: typeof tables.humansOnly) => ({
    ...tally(entry.deals, entry.won, entry.delta),
    takes: entry.takes,
    takeSuccessRate: rate(entry.takesWon, entry.takes)
  })

  return {
    summary: {
      deals: deals.length,
      matches: myMatches.length,
      matchesWon,
      matchWinRate: rate(matchesWon, myMatches.length),
      avgRank: ranks.length ? avg(ranks.reduce((a, b) => a + b, 0), ranks.length) : null,
      takes,
      takeRate: rate(takes, deals.length),
      takesWon,
      takeSuccessRate: rate(takesWon, takes),
      totalDelta,
      avgDelta: avg(totalDelta, deals.length),
      dealsWon,
      dealWinRate: rate(dealsWon, deals.length),
      longestWinStreak,
      currentStreak: { kind: lastKind, length: lastKind ? streak : 0 },
      avgTakerDiff: avg(takerDiff, takes),
      firstPlayedAt: first,
      lastPlayedAt: last
    },
    roles: {
      taker: tally(roles.taker.deals, roles.taker.won, roles.taker.delta),
      partner: tally(roles.partner.deals, roles.partner.won, roles.partner.delta),
      defender: tally(roles.defender.deals, roles.defender.won, roles.defender.delta)
    },
    contracts: CONTRACTS.map((contract) => {
      const acc = contractAcc.get(contract)
      return {
        contract,
        taken: acc?.taken ?? 0,
        won: acc?.won ?? 0,
        successRate: rate(acc?.won ?? 0, acc?.taken ?? 0),
        avgDiff: avg(acc?.diff ?? 0, acc?.taken ?? 0),
        avgDelta: avg(acc?.delta ?? 0, acc?.taken ?? 0),
        bestDelta: acc && acc.best > -Infinity ? acc.best : 0,
        avgTrumps: avg(acc?.trumps ?? 0, acc?.taken ?? 0),
        avgBouts: avg(acc?.bouts ?? 0, acc?.taken ?? 0),
        avgPoints: avg(acc?.points ?? 0, acc?.taken ?? 0)
      }
    }),
    bidding: {
      spoken,
      overcalls,
      strongPasses,
      boldTakes,
      avgPointsWhenTaking: avg(takePoints, takes),
      avgPointsWhenPassing: avg(passPoints, passCount)
    },
    situations: {
      bouts: boutsAcc.map((acc, bouts) => toBucket(`b${bouts}`, bouts === 0 ? 'Aucun bout' : bouts === 1 ? '1 bout' : `${bouts} bouts`, acc)),
      trumps: situationBuckets(TRUMP_BUCKETS, trumpAcc),
      strength: situationBuckets(STRENGTH_BUCKETS, strengthAcc),
      position: positionKeys.map(key => toBucket(key, positionLabel(key), positionAcc.get(key)!)),
      playerCount: [...countAcc.keys()].sort().map(count => toBucket(`p${count}`, `${count} joueurs`, countAcc.get(count)!)),
      matrix: matrixAcc.map((cells, bouts) => ({
        bouts,
        cells: STRENGTH_BUCKETS.map(bucket => toBucket(bucket.key, bucket.label, cells.get(bucket.key)!))
      }))
    },
    partner,
    feats,
    timeline,
    periods: [...periods.values()].sort((a, b) => a.key.localeCompare(b.key)),
    periodUnit,
    matches: myMatches.slice(-12).reverse().map(({ match, me }) => ({
      matchId: match.matchId,
      finishedAt: match.finishedAt,
      playerCount: match.playerCount,
      rank: me.rank,
      score: me.score,
      players: match.players.length,
      withBots: match.withBots
    })),
    tables: { humansOnly: tableTally(tables.humansOnly), withBots: tableTally(tables.withBots) },
    friends: friendList
  }
}
