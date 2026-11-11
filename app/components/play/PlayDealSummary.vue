<script setup lang="ts">
import type { PublicGameView } from '~~/shared/tarot'
import { contractLabels } from '~/utils/tarotContracts'

const props = defineProps<{
  state: PublicGameView
  localSeat: number | null
}>()

const emit = defineEmits<{
  continue: []
}>()

const over = computed(() => props.state.phase === 'MatchOver')

const rows = computed(() => props.state.seats
  .map((seat, index) => ({
    index,
    name: index === props.localSeat ? 'Vous' : seat.name,
    bot: seat.controlledBy === 'bot',
    delta: Number(props.state.lastDeltas?.[index] ?? 0),
    total: props.state.scores[index] ?? 0,
    taker: props.state.bid?.seat === index,
    partner: props.state.partnerSeat === index
  }))
  .sort((a, b) => over.value ? b.total - a.total : b.delta - a.delta))

const takerRow = computed(() => rows.value.find(row => row.taker) ?? null)
const takerWon = computed(() => (takerRow.value?.delta ?? 0) > 0)

const title = computed(() => {
  if (over.value) {
    const winner = rows.value[0]
    return winner?.index === props.localSeat ? 'Vous gagnez la partie !' : `${winner?.name} gagne la partie`
  }
  if (!takerRow.value || !props.state.bid) {
    return 'Fin de la donne'
  }
  const contract = contractLabels[props.state.bid.contract]
  return takerWon.value ? `${contract} réussie` : `${contract} chutée`
})

const description = computed(() => {
  if (over.value) {
    return `Après ${props.state.dealIndex + 1} donne${props.state.dealIndex ? 's' : ''}.`
  }
  if (!takerRow.value) {
    return 'Tout le monde a passé.'
  }
  return takerRow.value.index === props.localSeat ? 'Vous avez pris.' : `${takerRow.value.name} a pris.`
})

const medals = ['🥇', '🥈', '🥉']
</script>

<template>
  <PlayPanel
    :title="title"
    :description="description"
    :icon="over ? 'i-lucide-trophy' : takerWon ? 'i-lucide-party-popper' : 'i-lucide-scale'"
  >
    <ol class="divide-y divide-white/10 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
      <li
        v-for="(row, rank) in rows"
        :key="row.index"
        class="flex items-center gap-3 px-3 py-2"
        :class="row.index === localSeat ? 'bg-amber-300/10' : ''"
      >
        <span
          v-if="over"
          class="w-6 text-center text-lg"
        >{{ medals[rank] ?? '' }}</span>
        <UAvatar
          :alt="row.name"
          :icon="row.bot ? 'i-lucide-bot' : undefined"
          size="sm"
          class="bg-white/10 text-white"
        />
        <span class="min-w-0 flex-1 truncate text-sm">
          {{ row.name }}
          <UIcon
            v-if="row.taker"
            name="i-lucide-crown"
            class="ml-1 size-3.5 align-[-2px] text-amber-300"
          />
          <UIcon
            v-else-if="row.partner"
            name="i-lucide-handshake"
            class="ml-1 size-3.5 align-[-2px] text-sky-300"
          />
        </span>
        <span
          v-if="!over"
          class="w-14 text-right text-sm font-semibold tabular-nums"
          :class="row.delta > 0 ? 'text-emerald-300' : row.delta < 0 ? 'text-rose-300' : 'text-white/50'"
        >
          {{ row.delta > 0 ? `+${row.delta}` : row.delta }}
        </span>
        <span class="w-14 text-right text-sm text-white/70 tabular-nums">{{ row.total }}</span>
      </li>
    </ol>

    <template #footer>
      <template v-if="over">
        <UButton
          to="/dashboard"
          label="Retour à l’atelier"
          color="neutral"
          variant="ghost"
          class="text-white/70 hover:bg-white/10"
        />
        <UButton
          to="/play"
          label="Nouvelle table"
          icon="i-lucide-spade"
          size="lg"
        />
      </template>
      <UButton
        v-else
        :label="state.matchShouldEnd ? 'Voir le classement' : 'Donne suivante'"
        trailing-icon="i-lucide-arrow-right"
        size="lg"
        @click="emit('continue')"
      />
    </template>
  </PlayPanel>
</template>
