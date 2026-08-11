<script setup lang="ts">
import type { Contract, PublicGameView } from '~~/shared/tarot'
import { tarotPhaseLabel } from '~/utils/tarotPhaseLabel'

const props = defineProps<{
  state: PublicGameView
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
  <div class="rounded-xl border border-default bg-muted/40 p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm text-muted">
          Donne {{ state.dealIndex + 1 }}
          <span v-if="state.endMode === 'threshold'">· Objectif {{ state.endValue }} pts</span>
          <span v-else>· {{ state.endValue }} donnes</span>
        </p>
        <p
          v-if="contractLabel && takerName"
          class="mt-1 font-semibold text-highlighted"
        >
          {{ takerName }} · {{ contractLabel }}
        </p>
      </div>

      <UBadge
        color="neutral"
        variant="subtle"
      >
        {{ tarotPhaseLabel(state.phase) }}
      </UBadge>
    </div>

    <div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="(score, index) in state.scores"
        :key="index"
        class="flex items-center justify-between rounded-lg border border-default bg-default px-3 py-2 text-sm"
      >
        <span class="truncate text-muted">
          {{ state.seats[index]?.name || `Siège ${index + 1}` }}
        </span>
        <span class="font-semibold text-highlighted">{{ score }}</span>
      </div>
    </div>
  </div>
</template>
