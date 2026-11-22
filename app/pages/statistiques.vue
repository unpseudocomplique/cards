<script setup lang="ts">
import type { Contract } from '~~/shared/tarot'
import type { PlayerStats, SituationBucket } from '~~/shared/tarot/statsAggregate'
import { contractLabels } from '~/utils/tarotContracts'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

useSeoMeta({
  title: 'Statistiques'
})

type Filters = { period: 'all' | '30' | '90' | '365', players: 'all' | '3' | '4' | '5', tables: 'all' | 'humans' | 'bots' }

const route = useRoute()
const filters = reactive<Filters>({
  period: (route.query.period as Filters['period']) || 'all',
  players: (route.query.players as Filters['players']) || 'all',
  tables: (route.query.tables as Filters['tables']) || 'all'
})

watch(filters, () => {
  navigateTo({ query: { ...filters } }, { replace: true })
})

const { data, status, error } = await useFetch<{ stats: PlayerStats }>('/api/stats/me', {
  query: filters,
  watch: [() => ({ ...filters })]
})

const stats = computed(() => data.value?.stats ?? null)
const empty = computed(() => !stats.value || stats.value.summary.deals === 0)

const periodItems = [
  { value: 'all', label: 'Tout' },
  { value: '365', label: '12 mois' },
  { value: '90', label: '3 mois' },
  { value: '30', label: '30 jours' }
] as const
const playerItems = [
  { value: 'all', label: 'Toutes' },
  { value: '3', label: '3 j.' },
  { value: '4', label: '4 j.' },
  { value: '5', label: '5 j.' }
] as const
const tableItems = [
  { value: 'all', label: 'Toutes' },
  { value: 'humans', label: 'Entre amis' },
  { value: 'bots', label: 'Avec bots' }
] as const

const pct = (value: number) => `${Math.round(value * 100)} %`
const signed = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value * 10) / 10}`
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const longDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const bidLabels: Record<Contract | 'passe', string> = { passe: 'Passe', ...contractLabels }
const bidShort: Record<Contract | 'passe', string> = { passe: 'Passe', prise: 'Prise', garde: 'Garde', garde_sans: 'G. sans', garde_contre: 'G. contre' }
const roleLabels = { taker: 'preneur', partner: 'appelé', defender: 'en défense' } as const

/* Evolution */
const evolutionView = shallowRef<'cumulative' | 'rate' | 'avg'>('cumulative')
const evolutionItems = [
  { value: 'cumulative', label: 'Points cumulés' },
  { value: 'rate', label: 'Réussite en attaque' },
  { value: 'avg', label: 'Moyenne par donne' }
] as const

/** At most ~240 points on the chart: keep every n-th deal (and the last). */
function sample<T>(items: T[], max = 240): T[] {
  if (items.length <= max) {
    return items
  }
  const step = items.length / max
  const out: T[] = []
  for (let i = 0; i < max; i++) {
    out.push(items[Math.floor(i * step)]!)
  }
  out.push(items.at(-1)!)
  return out
}

const evolutionPoints = computed(() => {
  const timeline = stats.value?.timeline ?? []
  const points = timeline.map((point, index) => {
    const detail = `donne ${index + 1}, ${roleLabels[point.role]} (${signed(point.delta)})`
    if (evolutionView.value === 'rate') {
      return point.rollingTakeRate === null ? null : { x: shortDate(point.playedAt), y: point.rollingTakeRate, detail }
    }
    if (evolutionView.value === 'avg') {
      return { x: shortDate(point.playedAt), y: point.rollingAvg, detail }
    }
    return { x: shortDate(point.playedAt), y: point.cumulative, detail }
  }).filter(Boolean) as Array<{ x: string, y: number, detail: string }>
  return sample(points)
})

const evolutionFormat = computed(() => evolutionView.value === 'rate'
  ? (value: number) => pct(value)
  : (value: number) => String(Math.round(value)))

const evolutionCaption = computed(() => ({
  cumulative: 'Total de vos points, donne après donne.',
  rate: 'Part de contrats réussis sur vos 10 dernières prises.',
  avg: 'Moyenne de vos points sur les 20 dernières donnes.'
})[evolutionView.value])

/* Contracts */
const contractsTaken = computed(() => (stats.value?.contracts ?? []).filter(contract => contract.taken))
const maxTaken = computed(() => Math.max(1, ...contractsTaken.value.map(contract => contract.taken)))

/* Situations */
const situationView = shallowRef<'trumps' | 'position' | 'playerCount'>('trumps')
const situationItems = [
  { value: 'trumps', label: 'Atouts en main' },
  { value: 'position', label: 'Place à la table' },
  { value: 'playerCount', label: 'Nombre de joueurs' }
] as const

function bucketRows(buckets: SituationBucket[]) {
  return buckets.map(bucket => ({
    key: bucket.key,
    label: bucket.label,
    value: bucket.takeRate,
    text: bucket.deals ? pct(bucket.takeRate) : '—',
    detail: bucket.takes ? `${pct(bucket.successRate)} réussies` : bucket.deals ? `${bucket.deals} donnes` : undefined,
    muted: !bucket.deals
  }))
}

const situationRows = computed(() => stats.value ? bucketRows(stats.value.situations[situationView.value]) : [])
const boutRows = computed(() => stats.value ? bucketRows(stats.value.situations.bouts) : [])

function cellStyle(cell: SituationBucket) {
  if (!cell.deals) {
    return {}
  }
  const strength = 0.12 + cell.takeRate * 0.78
  return {
    background: `rgba(233, 199, 127, ${strength.toFixed(2)})`,
    color: cell.takeRate > 0.5 ? '#2b190e' : '#f6e7c4'
  }
}

function cellTitle(cell: SituationBucket, bouts: number) {
  if (!cell.deals) {
    return 'Aucune donne'
  }
  const said = (Object.entries(cell.bids) as Array<[Contract | 'passe', number]>)
    .filter(([, count]) => count)
    .map(([bid, count]) => `${bidLabels[bid]} ${count}`)
    .join(', ')
  return `${bouts} bout(s), ${cell.label} points : ${cell.deals} donnes, prise ${pct(cell.takeRate)}${cell.takes ? `, réussite ${pct(cell.successRate)}` : ''} (${said})`
}

/* Bidding */
const spokenTotal = computed(() => Object.values(stats.value?.bidding.spoken ?? {}).reduce((a, b) => a + b, 0))
const spokenSegments = computed(() => {
  const spoken = stats.value?.bidding.spoken
  if (!spoken || !spokenTotal.value) {
    return []
  }
  const shades: Record<Contract | 'passe', string> = {
    passe: '#5b4330',
    prise: '#8a6a3b',
    garde: '#b38a4a',
    garde_sans: '#d8b36a',
    garde_contre: '#f3dca2'
  }
  return (Object.keys(bidLabels) as Array<Contract | 'passe'>)
    .map(bid => ({ bid, count: spoken[bid], share: spoken[bid] / spokenTotal.value, color: shades[bid] }))
    .filter(segment => segment.count)
})

/* Friends */
const friendsBoard = computed(() => {
  const s = stats.value
  if (!s) {
    return []
  }
  return s.friends.slice(0, 12).map(friend => ({
    ...friend,
    yourAvg: friend.dealsTogether ? friend.yourDelta / friend.dealsTogether : 0,
    theirAvg: friend.dealsTogether ? friend.theirDelta / friend.dealsTogether : 0,
    theirRate: friend.theirTakes ? friend.theirTakesWon / friend.theirTakes : null,
    globalAvg: friend.global?.deals ? friend.global.totalDelta / friend.global.deals : null,
    globalRate: friend.global?.takes ? friend.global.takesWon / friend.global.takes : null
  }))
})

const nemesis = computed(() => [...friendsBoard.value]
  .filter(friend => friend.theirTakesAgainstYou >= 3)
  .sort((a, b) => b.theirTakesAgainstYouWon / b.theirTakesAgainstYou - a.theirTakesAgainstYouWon / a.theirTakesAgainstYou)[0] ?? null)
const bestPartner = computed(() => [...friendsBoard.value]
  .filter(friend => friend.sameCamp >= 2)
  .sort((a, b) => b.sameCampWon / b.sameCamp - a.sameCampWon / a.sameCamp)[0] ?? null)

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
}

const leaderboard = computed(() => {
  const s = stats.value
  if (!s) {
    return []
  }
  const rows = [
    { key: 'me', name: 'Vous', picture: null as string | null, deals: s.summary.deals, avg: s.summary.avgDelta, rate: s.summary.takes ? s.summary.takeSuccessRate : null, me: true },
    ...friendsBoard.value.filter(friend => friend.global).map(friend => ({
      key: friend.userId,
      name: friend.name,
      picture: friend.picture ?? null,
      deals: friend.global!.deals,
      avg: friend.globalAvg ?? 0,
      rate: friend.globalRate,
      me: false
    }))
  ]
  return rows.sort((a, b) => b.avg - a.avg)
})
const { user } = useUserSession()
</script>

<template>
  <UDashboardPanel id="stats">
    <template #header>
      <UDashboardNavbar title="Statistiques">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="stats-page mx-auto w-full max-w-6xl space-y-5">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 class="font-display text-4xl text-highlighted">
              Vos statistiques
            </h1>
            <p class="mt-1 text-sm text-muted">
              Chaque donne jouée en ligne compte, à partir de maintenant.
            </p>
          </div>
        </div>

        <div class="table-menu flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl px-4 py-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[10px] font-bold tracking-[0.14em] text-[#e9c77f]/80 uppercase">Période</span>
            <PlayGameButton
              v-for="item in periodItems"
              :key="item.value"
              size="sm"
              :label="item.label"
              :active="filters.period === item.value"
              @click="filters.period = item.value"
            />
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[10px] font-bold tracking-[0.14em] text-[#e9c77f]/80 uppercase">Joueurs</span>
            <PlayGameButton
              v-for="item in playerItems"
              :key="item.value"
              size="sm"
              :label="item.label"
              :active="filters.players === item.value"
              @click="filters.players = item.value"
            />
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[10px] font-bold tracking-[0.14em] text-[#e9c77f]/80 uppercase">Adversaires</span>
            <PlayGameButton
              v-for="item in tableItems"
              :key="item.value"
              size="sm"
              :label="item.label"
              :active="filters.tables === item.value"
              @click="filters.tables = item.value"
            />
          </div>
          <UIcon
            v-if="status === 'pending'"
            name="i-lucide-loader-circle"
            class="ml-auto size-4 animate-spin text-[#e9c77f]"
          />
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Statistiques indisponibles"
          :description="getApiErrorMessage(error)"
        />

        <StatsPanel
          v-else-if="empty"
          title="Pas encore de donne"
          subtitle="Jouez une partie : chaque donne terminée alimente vos statistiques."
          icon="i-lucide-chart-no-axes-combined"
        >
          <PlayGameButton
            to="/play"
            variant="gold"
            icon="i-lucide-spade"
            label="Ouvrir une table"
          />
        </StatsPanel>

        <template v-else-if="stats">
          <!-- Headline numbers -->
          <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatsKpi
              icon="i-lucide-layers"
              label="Donnes jouées"
              :value="stats.summary.deals"
              :detail="`${stats.summary.matches} parties terminées`"
            />
            <StatsKpi
              icon="i-lucide-crown"
              label="Parties gagnées"
              :value="stats.summary.matches ? pct(stats.summary.matchWinRate) : '—'"
              :detail="stats.summary.matches ? `${stats.summary.matchesWon} sur ${stats.summary.matches} · place moy. ${stats.summary.avgRank}` : 'Aucune partie finie'"
            />
            <StatsKpi
              icon="i-lucide-hand"
              label="Vous prenez"
              :value="pct(stats.summary.takeRate)"
              :detail="`${stats.summary.takes} prises`"
            />
            <StatsKpi
              icon="i-lucide-sword"
              label="Contrats réussis"
              :value="stats.summary.takes ? pct(stats.summary.takeSuccessRate) : '—'"
              :detail="stats.summary.takes ? `${stats.summary.takesWon} sur ${stats.summary.takes} · écart moy. ${signed(stats.summary.avgTakerDiff)}` : 'Pas encore de prise'"
              :tone="stats.summary.takes ? (stats.summary.takeSuccessRate >= 0.5 ? 'good' : 'bad') : 'neutral'"
            />
            <StatsKpi
              icon="i-lucide-coins"
              label="Points par donne"
              :value="signed(stats.summary.avgDelta)"
              :detail="`${signed(stats.summary.totalDelta)} au total`"
              :tone="stats.summary.avgDelta >= 0 ? 'good' : 'bad'"
            />
            <StatsKpi
              icon="i-lucide-flame"
              label="Meilleure série"
              :value="stats.summary.longestWinStreak"
              :detail="stats.summary.currentStreak.kind ? `En cours : ${stats.summary.currentStreak.length} donne${stats.summary.currentStreak.length > 1 ? 's' : ''} ${stats.summary.currentStreak.kind === 'won' ? 'gagnée' : 'perdue'}${stats.summary.currentStreak.length > 1 ? 's' : ''}` : undefined"
            />
          </div>

          <!-- Evolution -->
          <StatsPanel
            title="Évolution"
            :subtitle="evolutionCaption"
            icon="i-lucide-trending-up"
          >
            <template #aside>
              <div class="hidden flex-wrap justify-end gap-1.5 sm:flex">
                <PlayGameButton
                  v-for="item in evolutionItems"
                  :key="item.value"
                  size="sm"
                  :label="item.label"
                  :active="evolutionView === item.value"
                  @click="evolutionView = item.value"
                />
              </div>
            </template>
            <div class="mb-3 flex flex-wrap gap-1.5 sm:hidden">
              <PlayGameButton
                v-for="item in evolutionItems"
                :key="item.value"
                size="sm"
                :label="item.label"
                :active="evolutionView === item.value"
                @click="evolutionView = item.value"
              />
            </div>
            <StatsLineChart
              v-if="evolutionPoints.length > 1"
              :points="evolutionPoints"
              :format="evolutionFormat"
              :min="evolutionView === 'rate' ? 0 : undefined"
              :max="evolutionView === 'rate' ? 1 : undefined"
              :label="evolutionItems.find(item => item.value === evolutionView)!.label"
            />
            <p
              v-else
              class="py-8 text-center text-sm text-[#f6e7c4]/55 italic"
            >
              Encore quelques donnes et la courbe apparaîtra.
            </p>

            <div
              v-if="stats.periods.length"
              class="mt-4 overflow-x-auto"
            >
              <table class="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr class="text-left text-[10px] tracking-[0.12em] text-[#e9c77f]/75 uppercase">
                    <th class="py-1.5 font-bold">
                      {{ stats.periodUnit === 'week' ? 'Semaine du' : 'Mois' }}
                    </th>
                    <th class="py-1.5 text-right font-bold">
                      Donnes
                    </th>
                    <th class="py-1.5 text-right font-bold">
                      Prises réussies
                    </th>
                    <th class="py-1.5 text-right font-bold">
                      Pts / donne
                    </th>
                    <th class="py-1.5 text-right font-bold">
                      Parties gagnées
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-dashed divide-[#c9a463]/20">
                  <tr
                    v-for="period in [...stats.periods].reverse().slice(0, 8)"
                    :key="period.key"
                  >
                    <td class="py-1.5 text-[#f6e7c4]/85">
                      {{ period.label }}
                    </td>
                    <td class="py-1.5 text-right tabular-nums">
                      {{ period.deals }}
                    </td>
                    <td class="py-1.5 text-right tabular-nums">
                      {{ period.takes ? `${period.takesWon}/${period.takes} · ${pct(period.successRate)}` : '—' }}
                    </td>
                    <td
                      class="py-1.5 text-right font-semibold tabular-nums"
                      :class="period.avgDelta >= 0 ? 'text-[#a8e0a0]' : 'text-[#ff9c8a]'"
                    >
                      {{ signed(period.avgDelta) }}
                    </td>
                    <td class="py-1.5 text-right tabular-nums">
                      {{ period.matches ? `${period.matchesWon}/${period.matches}` : '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </StatsPanel>

          <div class="grid gap-5 lg:grid-cols-2">
            <!-- Contracts -->
            <StatsPanel
              title="Vos contrats"
              subtitle="Ce que vous prenez, avec quelle main, et comment ça finit."
              icon="i-lucide-scroll-text"
            >
              <p
                v-if="!contractsTaken.length"
                class="text-sm text-[#f6e7c4]/55 italic"
              >
                Vous n’avez pas encore pris.
              </p>
              <ul
                v-else
                class="space-y-3"
              >
                <li
                  v-for="contract in contractsTaken"
                  :key="contract.contract"
                  class="rounded-lg border border-[#c9a463]/25 bg-[#1c0f07]/35 p-3"
                >
                  <div class="flex items-baseline gap-2">
                    <span class="font-display text-xl text-[#f6e7c4]">{{ contractLabels[contract.contract] }}</span>
                    <span class="text-xs text-[#f6e7c4]/55">{{ contract.taken }} fois</span>
                    <span
                      class="ml-auto text-sm font-bold tabular-nums"
                      :class="contract.successRate >= 0.5 ? 'text-[#a8e0a0]' : 'text-[#ff9c8a]'"
                    >{{ pct(contract.successRate) }} réussies</span>
                  </div>
                  <div class="mt-2 h-2 overflow-hidden rounded-full bg-[#1c0f07]/70">
                    <div
                      class="h-full rounded-full bg-gradient-to-r from-[#a9793a] to-[#f0d08a]"
                      :style="{ width: `${(contract.taken / maxTaken) * 100}%` }"
                    />
                  </div>
                  <dl class="mt-2 grid grid-cols-3 gap-2 text-xs sm:grid-cols-5">
                    <div>
                      <dt class="text-[#f6e7c4]/50">
                        Écart moyen
                      </dt>
                      <dd class="font-semibold tabular-nums">
                        {{ signed(contract.avgDiff) }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-[#f6e7c4]/50">
                        Pts / prise
                      </dt>
                      <dd class="font-semibold tabular-nums">
                        {{ signed(contract.avgDelta) }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-[#f6e7c4]/50">
                        Atouts
                      </dt>
                      <dd class="font-semibold tabular-nums">
                        {{ contract.avgTrumps }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-[#f6e7c4]/50">
                        Bouts
                      </dt>
                      <dd class="font-semibold tabular-nums">
                        {{ contract.avgBouts }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-[#f6e7c4]/50">
                        Force
                      </dt>
                      <dd class="font-semibold tabular-nums">
                        {{ contract.avgPoints }} pts
                      </dd>
                    </div>
                  </dl>
                </li>
              </ul>
            </StatsPanel>

            <!-- Bidding -->
            <StatsPanel
              title="Aux enchères"
              subtitle="Ce que vous annoncez quand vient votre tour."
              icon="i-lucide-megaphone"
            >
              <div
                v-if="spokenSegments.length"
                class="flex h-9 gap-0.5 overflow-hidden rounded-md"
              >
                <div
                  v-for="segment in spokenSegments"
                  :key="segment.bid"
                  class="grid min-w-0 place-items-center first:rounded-l-md last:rounded-r-md"
                  :style="{ flexGrow: segment.count, background: segment.color }"
                  :title="`${bidLabels[segment.bid]} : ${segment.count} (${pct(segment.share)})`"
                >
                  <span
                    v-if="segment.share >= 0.09"
                    class="truncate px-1 text-[11px] font-bold"
                    :class="segment.bid === 'passe' || segment.bid === 'prise' ? 'text-[#f6e7c4]' : 'text-[#2b190e]'"
                  >{{ bidShort[segment.bid] }}</span>
                </div>
              </div>
              <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#f6e7c4]/75">
                <li
                  v-for="segment in spokenSegments"
                  :key="segment.bid"
                  class="flex items-center gap-1.5"
                >
                  <span
                    class="size-2.5 rounded-sm"
                    :style="{ background: segment.color }"
                  />
                  {{ bidLabels[segment.bid] }} <span class="font-semibold tabular-nums">{{ pct(segment.share) }}</span>
                </li>
              </ul>

              <dl class="mt-5 grid grid-cols-2 gap-3">
                <div class="rounded-lg bg-[#1c0f07]/40 p-3">
                  <dt class="text-xs text-[#f6e7c4]/55">
                    Force moyenne quand vous prenez
                  </dt>
                  <dd class="font-display text-3xl tabular-nums">
                    {{ stats.bidding.avgPointsWhenTaking || '—' }}
                  </dd>
                </div>
                <div class="rounded-lg bg-[#1c0f07]/40 p-3">
                  <dt class="text-xs text-[#f6e7c4]/55">
                    … et quand vous passez
                  </dt>
                  <dd class="font-display text-3xl tabular-nums">
                    {{ stats.bidding.avgPointsWhenPassing || '—' }}
                  </dd>
                </div>
                <div class="rounded-lg bg-[#1c0f07]/40 p-3">
                  <dt class="text-xs text-[#f6e7c4]/55">
                    Passes avec une belle main (56 pts +)
                  </dt>
                  <dd class="font-display text-3xl tabular-nums">
                    {{ stats.bidding.strongPasses }}
                  </dd>
                </div>
                <div class="rounded-lg bg-[#1c0f07]/40 p-3">
                  <dt class="text-xs text-[#f6e7c4]/55">
                    Prises culottées (moins de 40 pts)
                  </dt>
                  <dd class="font-display text-3xl tabular-nums">
                    {{ stats.bidding.boldTakes }}
                  </dd>
                </div>
              </dl>
              <p class="mt-3 text-xs text-[#f6e7c4]/50">
                Force : décompte classique des clubs (atouts, bouts, honneurs, longues et coupes). {{ stats.bidding.overcalls }} de vos prises passaient par-dessus une autre enchère.
              </p>
            </StatsPanel>
          </div>

          <!-- When do you take -->
          <StatsPanel
            title="Quand prenez-vous ?"
            subtitle="Votre main au moment de la donne (avant le chien), et ce que vous en avez fait."
            icon="i-lucide-grid-3x3"
          >
            <div class="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <div class="min-w-0">
                <p class="mb-2 text-xs text-[#f6e7c4]/60">
                  Part des donnes où vous prenez, selon vos bouts et la force de la main. Dans chaque case, l’annonce que vous faites le plus souvent.
                </p>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[30rem] border-separate border-spacing-0.5 text-xs">
                    <thead>
                      <tr>
                        <th />
                        <th
                          v-for="cell in stats.situations.matrix[0]!.cells"
                          :key="cell.key"
                          class="pb-1 font-semibold text-[#e9c77f]/80 tabular-nums"
                        >
                          {{ cell.label }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in stats.situations.matrix"
                        :key="row.bouts"
                      >
                        <th class="pr-2 text-right font-semibold whitespace-nowrap text-[#e9c77f]/80">
                          {{ row.bouts === 0 ? '0 bout' : `${row.bouts} bout${row.bouts > 1 ? 's' : ''}` }}
                        </th>
                        <td
                          v-for="cell in row.cells"
                          :key="cell.key"
                          class="h-14 rounded-md text-center align-middle"
                          :class="cell.deals ? '' : 'bg-[#1c0f07]/40 text-[#f6e7c4]/25'"
                          :style="cellStyle(cell)"
                          :title="cellTitle(cell, row.bouts)"
                        >
                          <template v-if="cell.deals">
                            <span class="block text-sm font-bold tabular-nums">{{ pct(cell.takeRate) }}</span>
                            <span class="block text-[10px] opacity-80">{{ cell.usualBid ? bidShort[cell.usualBid] : '' }} · {{ cell.deals }}</span>
                          </template>
                          <template v-else>
                            ·
                          </template>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p class="mt-2 text-[11px] text-[#f6e7c4]/45">
                  Colonnes : force de la main en points. Plus la case est dorée, plus vous prenez.
                </p>
              </div>

              <div class="min-w-0 space-y-5">
                <div>
                  <p class="mb-2 text-[10px] font-bold tracking-[0.14em] text-[#e9c77f]/80 uppercase">
                    Par nombre de bouts · prise et réussite
                  </p>
                  <StatsBars :rows="boutRows" />
                </div>
                <div>
                  <div class="mb-2 flex flex-wrap gap-1.5">
                    <PlayGameButton
                      v-for="item in situationItems"
                      :key="item.value"
                      size="sm"
                      :label="item.label"
                      :active="situationView === item.value"
                      @click="situationView = item.value"
                    />
                  </div>
                  <StatsBars :rows="situationRows" />
                </div>
              </div>
            </div>
          </StatsPanel>

          <div class="grid gap-5 lg:grid-cols-3">
            <!-- Roles -->
            <StatsPanel
              title="Dans chaque camp"
              icon="i-lucide-swords"
            >
              <ul class="space-y-3">
                <li
                  v-for="role in (['taker', 'partner', 'defender'] as const)"
                  :key="role"
                  class="flex items-center gap-3"
                  :class="stats.roles[role].deals ? '' : 'opacity-45'"
                >
                  <UIcon
                    :name="role === 'taker' ? 'i-lucide-sword' : role === 'partner' ? 'i-lucide-handshake' : 'i-lucide-shield'"
                    class="size-5 shrink-0 text-[#e9c77f]"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold">
                      {{ role === 'taker' ? 'Preneur' : role === 'partner' ? 'Appelé (5 joueurs)' : 'Défense' }}
                    </p>
                    <p class="text-xs text-[#f6e7c4]/55">
                      {{ stats.roles[role].deals }} donnes · {{ signed(stats.roles[role].avgDelta) }} pts / donne
                    </p>
                  </div>
                  <span class="font-display text-2xl tabular-nums">{{ stats.roles[role].deals ? pct(stats.roles[role].rate) : '—' }}</span>
                </li>
              </ul>
              <p
                v-if="stats.partner.calledSelf"
                class="mt-4 text-xs text-[#f6e7c4]/60"
              >
                Seul contre tous (roi appelé dans votre main) : {{ stats.partner.calledSelfWon }}/{{ stats.partner.calledSelf }} réussis.
              </p>
            </StatsPanel>

            <!-- Feats -->
            <StatsPanel
              title="Faits d’armes"
              icon="i-lucide-trophy"
              class="lg:col-span-2"
            >
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div class="rounded-lg bg-[#1c0f07]/40 p-3">
                  <p class="text-xs text-[#f6e7c4]/55">
                    Petit au bout
                  </p>
                  <p class="font-display text-3xl tabular-nums">
                    {{ stats.feats.petitAuBout }}
                  </p>
                  <p class="text-[11px] text-[#f6e7c4]/45">
                    {{ stats.feats.petitLost }} petit{{ stats.feats.petitLost > 1 ? 's' : '' }} perdu{{ stats.feats.petitLost > 1 ? 's' : '' }}
                  </p>
                </div>
                <div class="rounded-lg bg-[#1c0f07]/40 p-3">
                  <p class="text-xs text-[#f6e7c4]/55">
                    Poignées
                  </p>
                  <p class="font-display text-3xl tabular-nums">
                    {{ stats.feats.poignees.simple + stats.feats.poignees.double + stats.feats.poignees.triple }}
                  </p>
                  <p class="text-[11px] text-[#f6e7c4]/45">
                    {{ stats.feats.poignees.simple }} simple · {{ stats.feats.poignees.double }} double · {{ stats.feats.poignees.triple }} triple
                  </p>
                </div>
                <div class="rounded-lg bg-[#1c0f07]/40 p-3">
                  <p class="text-xs text-[#f6e7c4]/55">
                    Chelems
                  </p>
                  <p class="font-display text-3xl tabular-nums">
                    {{ stats.feats.chelemsMade }}
                  </p>
                  <p class="text-[11px] text-[#f6e7c4]/45">
                    {{ stats.feats.chelemsAnnounced }} annoncé{{ stats.feats.chelemsAnnounced > 1 ? 's' : '' }} · {{ stats.feats.chelemsDefended }} en défense
                  </p>
                </div>
                <div class="rounded-lg bg-[#1c0f07]/40 p-3">
                  <p class="text-xs text-[#f6e7c4]/55">
                    Gardes sans / contre
                  </p>
                  <p class="font-display text-3xl tabular-nums">
                    {{ stats.feats.gardeSansMade + stats.feats.gardeContreMade }}
                  </p>
                  <p class="text-[11px] text-[#f6e7c4]/45">
                    {{ stats.feats.gardeSansMade }} sans · {{ stats.feats.gardeContreMade }} contre, réussies
                  </p>
                </div>
              </div>
              <ul class="mt-4 space-y-2 text-sm">
                <li
                  v-if="stats.feats.biggestWin"
                  class="flex items-center gap-2"
                >
                  <UIcon
                    name="i-lucide-flame"
                    class="size-4 shrink-0 text-[#ffbf6b]"
                  />
                  <span class="flex-1">Plus belle donne : {{ contractLabels[stats.feats.biggestWin.contract] }}{{ stats.feats.biggestWin.role === 'taker' ? '' : ` de ${stats.feats.biggestWin.takerName}` }}, {{ roleLabels[stats.feats.biggestWin.role] }}, le {{ longDate(stats.feats.biggestWin.playedAt) }}</span>
                  <span class="font-bold text-[#a8e0a0] tabular-nums">{{ signed(stats.feats.biggestWin.delta) }}</span>
                </li>
                <li
                  v-if="stats.feats.biggestDiff"
                  class="flex items-center gap-2"
                >
                  <UIcon
                    name="i-lucide-gauge"
                    class="size-4 shrink-0 text-[#e9c77f]"
                  />
                  <span class="flex-1">Contrat le mieux fait : {{ contractLabels[stats.feats.biggestDiff.contract] }} faite de {{ stats.feats.biggestDiff.diff }}, le {{ longDate(stats.feats.biggestDiff.playedAt) }}</span>
                  <span class="font-bold tabular-nums">+{{ stats.feats.biggestDiff.diff }}</span>
                </li>
                <li
                  v-if="stats.feats.worstLoss"
                  class="flex items-center gap-2"
                >
                  <UIcon
                    name="i-lucide-cloud-rain"
                    class="size-4 shrink-0 text-[#b9d8ff]"
                  />
                  <span class="flex-1">Pire donne : {{ contractLabels[stats.feats.worstLoss.contract] }}{{ stats.feats.worstLoss.role === 'taker' ? '' : ` de ${stats.feats.worstLoss.takerName}` }}, {{ roleLabels[stats.feats.worstLoss.role] }}, le {{ longDate(stats.feats.worstLoss.playedAt) }}</span>
                  <span class="font-bold text-[#ff9c8a] tabular-nums">{{ signed(stats.feats.worstLoss.delta) }}</span>
                </li>
              </ul>
            </StatsPanel>
          </div>

          <!-- Friends -->
          <StatsPanel
            title="Face à vos amis"
            subtitle="Les personnes avec qui vous avez joué, sur les donnes jouées ensemble."
            icon="i-lucide-users"
          >
            <p
              v-if="!friendsBoard.length"
              class="text-sm text-[#f6e7c4]/55 italic"
            >
              Invitez des amis à votre table pour vous comparer à eux.
            </p>
            <template v-else>
              <div
                v-if="nemesis || bestPartner"
                class="mb-4 grid gap-3 sm:grid-cols-2"
              >
                <div
                  v-if="nemesis"
                  class="rounded-lg border border-[#ff9c8a]/30 bg-[#1c0f07]/40 p-3 text-sm"
                >
                  <p class="text-[10px] font-bold tracking-[0.14em] text-[#ff9c8a] uppercase">
                    Bête noire
                  </p>
                  <p class="mt-1">
                    <strong>{{ nemesis.name }}</strong> réussit {{ nemesis.theirTakesAgainstYouWon }} de ses {{ nemesis.theirTakesAgainstYou }} prises contre vous.
                  </p>
                </div>
                <div
                  v-if="bestPartner"
                  class="rounded-lg border border-[#a8e0a0]/30 bg-[#1c0f07]/40 p-3 text-sm"
                >
                  <p class="text-[10px] font-bold tracking-[0.14em] text-[#a8e0a0] uppercase">
                    Meilleur allié
                  </p>
                  <p class="mt-1">
                    Avec <strong>{{ bestPartner.name }}</strong> dans votre camp : {{ bestPartner.sameCampWon }} donnes gagnées sur {{ bestPartner.sameCamp }}.
                  </p>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr class="text-left text-[10px] tracking-[0.12em] text-[#e9c77f]/75 uppercase">
                      <th class="py-1.5 font-bold">
                        Joueur
                      </th>
                      <th class="py-1.5 text-right font-bold">
                        Ensemble
                      </th>
                      <th class="py-1.5 text-right font-bold">
                        Parties devant / derrière
                      </th>
                      <th class="py-1.5 text-right font-bold">
                        Vous / l’autre, pts par donne
                      </th>
                      <th class="py-1.5 text-right font-bold">
                        Ses prises contre vous
                      </th>
                      <th class="py-1.5 text-right font-bold">
                        Vos prises en face
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-dashed divide-[#c9a463]/20">
                    <tr
                      v-for="friend in friendsBoard"
                      :key="friend.userId"
                    >
                      <td class="py-2">
                        <span class="flex items-center gap-2">
                          <img
                            v-if="friend.picture"
                            :src="friend.picture"
                            alt=""
                            class="size-7 rounded-full object-cover ring-2 ring-[#c9a463]"
                            referrerpolicy="no-referrer"
                          >
                          <span
                            v-else
                            class="grid size-7 place-items-center rounded-full bg-[#e8d5a8] text-[11px] font-bold text-[#3b2a18] ring-2 ring-[#c9a463]"
                          >{{ initials(friend.name) }}</span>
                          <span class="truncate font-semibold">{{ friend.name }}</span>
                        </span>
                      </td>
                      <td class="py-2 text-right text-xs text-[#f6e7c4]/75 tabular-nums">
                        {{ friend.dealsTogether }} donnes<br>{{ friend.matchesTogether }} parties
                      </td>
                      <td class="py-2 text-right tabular-nums">
                        <span class="text-[#a8e0a0]">{{ friend.matchesAhead }}</span> / <span class="text-[#ff9c8a]">{{ friend.matchesBehind }}</span>
                      </td>
                      <td class="py-2 text-right tabular-nums">
                        <span
                          class="font-semibold"
                          :class="friend.yourAvg >= friend.theirAvg ? 'text-[#a8e0a0]' : 'text-[#ff9c8a]'"
                        >{{ signed(friend.yourAvg) }}</span>
                        <span class="text-[#f6e7c4]/55"> / {{ signed(friend.theirAvg) }}</span>
                      </td>
                      <td class="py-2 text-right tabular-nums">
                        {{ friend.theirTakesAgainstYou ? `${friend.theirTakesAgainstYouWon}/${friend.theirTakesAgainstYou}` : '—' }}
                      </td>
                      <td class="py-2 text-right tabular-nums">
                        {{ friend.yourTakesAgainstThem ? `${friend.yourTakesAgainstThemWon}/${friend.yourTakesAgainstThem}` : '—' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div
                v-if="leaderboard.length > 1"
                class="mt-5"
              >
                <p class="mb-2 text-[10px] font-bold tracking-[0.14em] text-[#e9c77f]/80 uppercase">
                  Classement général · points par donne, toutes tables
                </p>
                <ol class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <li
                    v-for="(row, index) in leaderboard"
                    :key="row.key"
                    class="flex items-center gap-2.5 rounded-lg px-3 py-2"
                    :class="row.me ? 'bg-[#e9c77f]/15 ring-1 ring-[#e9c77f]/60' : 'bg-[#1c0f07]/40'"
                  >
                    <span class="w-5 text-center font-display text-xl text-[#e9c77f] tabular-nums">{{ index + 1 }}</span>
                    <img
                      v-if="row.me ? user?.picture : row.picture"
                      :src="(row.me ? user?.picture : row.picture) ?? undefined"
                      alt=""
                      class="size-7 rounded-full object-cover ring-2 ring-[#c9a463]"
                      referrerpolicy="no-referrer"
                    >
                    <span
                      v-else
                      class="grid size-7 place-items-center rounded-full bg-[#e8d5a8] text-[11px] font-bold text-[#3b2a18] ring-2 ring-[#c9a463]"
                    >{{ initials(row.name) }}</span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-semibold">{{ row.name }}</span>
                      <span class="block text-[11px] text-[#f6e7c4]/55">{{ row.deals }} donnes · {{ row.rate === null ? '—' : pct(row.rate) }} de prises réussies</span>
                    </span>
                    <span
                      class="font-bold tabular-nums"
                      :class="row.avg >= 0 ? 'text-[#a8e0a0]' : 'text-[#ff9c8a]'"
                    >{{ signed(row.avg) }}</span>
                  </li>
                </ol>
              </div>
            </template>
          </StatsPanel>

          <div class="grid gap-5 lg:grid-cols-2">
            <!-- Tables -->
            <StatsPanel
              title="Entre amis ou avec les bots"
              subtitle="Les tables avec au moins un bot sont comptées à part."
              icon="i-lucide-bot"
            >
              <div class="grid grid-cols-2 gap-3">
                <div
                  v-for="kind in (['humansOnly', 'withBots'] as const)"
                  :key="kind"
                  class="rounded-lg bg-[#1c0f07]/40 p-3"
                  :class="stats.tables[kind].deals ? '' : 'opacity-45'"
                >
                  <p class="flex items-center gap-1.5 text-xs font-semibold text-[#e9c77f]">
                    <UIcon
                      :name="kind === 'humansOnly' ? 'i-lucide-users' : 'i-lucide-bot'"
                      class="size-4"
                    />
                    {{ kind === 'humansOnly' ? 'Entre amis' : 'Avec des bots' }}
                  </p>
                  <p class="mt-1 font-display text-3xl tabular-nums">
                    {{ stats.tables[kind].deals ? signed(stats.tables[kind].avgDelta) : '—' }}
                  </p>
                  <p class="text-[11px] text-[#f6e7c4]/55">
                    pts / donne · {{ stats.tables[kind].deals }} donnes
                  </p>
                  <p class="mt-1 text-xs text-[#f6e7c4]/75">
                    {{ stats.tables[kind].takes ? `${pct(stats.tables[kind].takeSuccessRate)} de ${stats.tables[kind].takes} prises réussies` : 'Aucune prise' }}
                  </p>
                </div>
              </div>
            </StatsPanel>

            <!-- Recent matches -->
            <StatsPanel
              title="Dernières parties"
              icon="i-lucide-history"
            >
              <p
                v-if="!stats.matches.length"
                class="text-sm text-[#f6e7c4]/55 italic"
              >
                Aucune partie terminée pour l’instant.
              </p>
              <ul
                v-else
                class="divide-y divide-dashed divide-[#c9a463]/20"
              >
                <li
                  v-for="match in stats.matches.slice(0, 6)"
                  :key="match.matchId"
                  class="flex items-center gap-3 py-2 text-sm"
                >
                  <span
                    class="grid size-8 shrink-0 place-items-center rounded-full font-display text-lg"
                    :class="match.rank === 1 ? 'bg-gradient-to-b from-[#f3dca2] to-[#b38a4a] text-[#2b190e]' : 'bg-[#1c0f07]/60 text-[#f6e7c4]'"
                  >{{ match.rank }}</span>
                  <span class="min-w-0 flex-1">
                    <span class="block">{{ match.rank === 1 ? 'Victoire' : `${match.rank}e sur ${match.players}` }}</span>
                    <span class="block text-xs text-[#f6e7c4]/55">{{ longDate(match.finishedAt) }} · {{ match.playerCount }} joueurs{{ match.withBots ? ' · avec bots' : '' }}</span>
                  </span>
                  <span
                    class="font-bold tabular-nums"
                    :class="match.score >= 0 ? 'text-[#a8e0a0]' : 'text-[#ff9c8a]'"
                  >{{ signed(match.score) }}</span>
                </li>
              </ul>
            </StatsPanel>
          </div>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
