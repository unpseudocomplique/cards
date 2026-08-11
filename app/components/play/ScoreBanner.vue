<script setup lang="ts">
import type { Contract, PublicGameView } from '~~/shared/tarot'
import { tarotPhaseLabel } from '~/utils/tarotPhaseLabel'

const props = defineProps<{
  state: PublicGameView
  compact?: boolean
}>()

const contractLabels: Record<Contract, string> = {
  prise: 'Prise',
  garde: 'Garde',
  garde_sans: 'Garde sans',
  garde_contre: 'Garde contre',
}

const contractLabel = computed(() => {
  const contract = props.state.bid?.contract
  return contract ? contractLabels[contract] : null
})

const takerName = computed(() => {
  const seat = props.state.bid?.seat
  if (seat === undefined) {
    return null
  }
  return props.state.seats.find(entry => entry.seatId === seat)?.name || `Siège ${seat + 1}`
})
</script>

<template>
  <div
    class="border border-white/10 bg-black/45 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md"
    :class="compact ? 'rounded-2xl px-3 py-2.5' : 'rounded-xl p-4'"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs tracking-wide text-white/55">
          Donne {{ state.dealIndex + 1 }}
          <span v-if="state.endMode === 'threshold'"> · {{ state.endValue }} pts</span>
          <span v-else> · {{ state.endValue }} donne{{ state.endValue > 1 ? 's' : '' }}</span>
          <span v-if="contractLabel && takerName"> · {{ takerName }} · {{ contractLabel }}</span>
        </p>
        <div
          v-if="compact"
          class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm"
        >
          <span
            v-for="(score, index) in state.scores"
            :key="index"
            class="inline-flex items-center gap-1.5"
          >
            <span class="max-w-24 truncate text-white/60">{{ state.seats[index]?.name || `J${index + 1}` }}</span>
            <span class="font-semibold tabular-nums text-amber-50">{{ score }}</span>
          </span>
        </div>
        <p
          v-else-if="contractLabel && takerName"
          class="mt-1 font-semibold text-amber-50"
        >
          {{ takerName }} · {{ contractLabel }}
        </p>
      </div>

      <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80">
        {{ tarotPhaseLabel(state.phase) }}
      </span>
    </div>

    <div
      v-if="!compact"
      class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div
        v-for="(score, index) in state.scores"
        :key="index"
        class="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
      >
        <span class="truncate text-white/60">
          {{ state.seats[index]?.name || `Siège ${index + 1}` }}
        </span>
        <span class="font-semibold tabular-nums text-amber-50">{{ score }}</span>
      </div>
    </div>
  </div>
</template>
