<script setup lang="ts">
import type { PublicGameView } from '~~/shared/tarot'
import { contractLabels } from '~/utils/tarotContracts'
import { seatAvatar } from '~/utils/seatAvatar'

/** The score notebook, opened: totals and one line per deal played. */
const props = defineProps<{
  state: PublicGameView
  localSeat: number | null
}>()

defineEmits<{ close: [] }>()

function seatName(seat: number) {
  return seat === props.localSeat ? 'Vous' : props.state.seats[seat]?.name ?? `Joueur ${seat + 1}`
}

const ranking = computed(() => props.state.seats
  .map((seat, index) => ({ index, name: seatName(index), avatar: seatAvatar(seat), total: props.state.scores[index] ?? 0 }))
  .sort((a, b) => b.total - a.total))

const deals = computed(() => [...(props.state.dealHistory ?? [])].map((deal, index) => ({ ...deal, number: index + 1 })).reverse())

const goal = computed(() => props.state.endMode === 'threshold'
  ? `Premier à ${props.state.endValue} points`
  : `${props.state.endValue} donnes`)
</script>

<template>
  <div class="table-paper relative max-h-[86dvh] w-[min(92vw,26rem)] overflow-y-auto rounded-lg px-5 pt-4 pb-5 short:max-h-[90dvh] short:w-[min(92vw,40rem)] short:py-3">
    <button
      type="button"
      class="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full text-[#3b2a18]/60 transition hover:bg-black/5 hover:text-[#3b2a18]"
      aria-label="Fermer"
      @click="$emit('close')"
    >
      <UIcon
        name="i-lucide-x"
        class="size-4.5"
      />
    </button>
    <h2 class="font-display text-3xl leading-none">
      Scores
    </h2>
    <p class="mt-1 text-xs text-[#3b2a18]/60">
      {{ goal }} · donne {{ state.dealIndex + 1 }}
    </p>

    <div class="mt-3 grid gap-4 short:grid-cols-2">
      <ol class="divide-y divide-dashed divide-[#5a3c1e]/25">
        <li
          v-for="(row, rank) in ranking"
          :key="row.index"
          class="flex items-center gap-2.5 py-1.5"
        >
          <span class="w-4 text-center text-xs font-bold text-[#3b2a18]/50 tabular-nums">{{ rank + 1 }}</span>
          <img
            v-if="row.avatar.src"
            :src="row.avatar.src"
            alt=""
            class="size-7 rounded-full object-cover ring-2 ring-[#c9a463]"
            referrerpolicy="no-referrer"
          >
          <span
            v-else
            class="grid size-7 place-items-center rounded-full bg-[#e8d5a8] text-[11px] font-bold ring-2 ring-[#c9a463]"
          >{{ row.avatar.initials }}</span>
          <span
            class="min-w-0 flex-1 truncate text-sm font-semibold"
            :class="row.index === localSeat ? 'text-[#7a4a10]' : ''"
          >{{ row.name }}</span>
          <span class="text-base font-extrabold tabular-nums">{{ row.total }}</span>
        </li>
      </ol>

      <div v-if="deals.length">
        <p class="mb-1 text-[10px] font-bold tracking-[0.12em] text-[#3b2a18]/50 uppercase">
          Donnes
        </p>
        <ul class="space-y-1">
          <li
            v-for="deal in deals"
            :key="deal.number"
            class="flex items-center gap-2 text-xs"
          >
            <span class="w-5 text-[#3b2a18]/45 tabular-nums">{{ deal.number }}.</span>
            <UIcon
              :name="deal.success ? 'i-lucide-check' : 'i-lucide-x'"
              class="size-3.5 shrink-0"
              :class="deal.success ? 'text-emerald-700' : 'text-[#9b2a1e]'"
            />
            <span class="min-w-0 flex-1 truncate">
              {{ contractLabels[deal.contract] }} de {{ seatName(deal.takerSeat) }}
              <span class="text-[#3b2a18]/55">{{ deal.success ? 'faite' : 'chutée' }} de {{ Math.abs(deal.diff) }}</span>
            </span>
            <span
              class="font-bold tabular-nums"
              :class="(deal.deltas[localSeat ?? -1] ?? 0) >= 0 ? 'text-emerald-800' : 'text-[#9b2a1e]'"
            >{{ localSeat != null ? ((deal.deltas[localSeat] ?? 0) > 0 ? '+' : '') + (deal.deltas[localSeat] ?? 0) : '' }}</span>
          </li>
        </ul>
      </div>
      <p
        v-else
        class="text-sm text-[#3b2a18]/55 italic"
      >
        Aucune donne jouée pour l’instant.
      </p>
    </div>
  </div>
</template>
