<script setup lang="ts">
import type { Contract, PublicGameView } from '~~/shared/tarot'
import { contractLabels, contractRank, contracts } from '~/utils/tarotContracts'

const props = defineProps<{
  state: PublicGameView
  myTurn: boolean
  localSeat: number | null
}>()

const emit = defineEmits<{
  bid: [bid: Contract | 'passe']
}>()

const spoken = computed(() => props.state.bidSpoken ?? [])

const highest = computed<Contract | null>(() => {
  const bids = spoken.value.filter(entry => entry.bid !== 'passe')
  return (bids.at(-1)?.bid as Contract | undefined) ?? null
})

function allowed(contract: Contract) {
  return !highest.value || contractRank[contract] > contractRank[highest.value]
}

function seatName(seat: number) {
  if (seat === props.localSeat) {
    return 'Vous'
  }
  return props.state.seats[seat]?.name ?? `Joueur ${seat + 1}`
}

const thinking = computed(() => seatName(props.state.currentSeat))
</script>

<template>
  <div class="mx-auto w-full max-w-2xl rounded-2xl bg-neutral-950/75 p-3 text-white ring-1 ring-white/10 backdrop-blur-xl sm:p-4">
    <div class="flex items-center justify-between gap-3">
      <p class="font-medium">
        <template v-if="myTurn">
          À vous de parler
        </template>
        <span
          v-else
          class="flex items-center gap-2 text-white/70"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-4 animate-spin"
          />
          {{ thinking }} réfléchit…
        </span>
      </p>
      <p
        v-if="highest"
        class="text-xs text-white/60"
      >
        À battre : <span class="font-semibold text-amber-200">{{ contractLabels[highest] }}</span>
      </p>
    </div>

    <div
      v-if="spoken.length"
      class="mt-2 flex flex-wrap gap-1"
    >
      <span
        v-for="(entry, index) in spoken"
        :key="`${entry.seat}-${index}`"
        class="rounded-md px-1.5 py-0.5 text-[11px]"
        :class="entry.bid === 'passe' ? 'bg-white/5 text-white/50' : 'bg-amber-400/15 text-amber-100'"
      >
        {{ seatName(entry.seat) }} · {{ entry.bid === 'passe' ? 'Passe' : contractLabels[entry.bid] }}
      </span>
    </div>

    <div
      v-if="myTurn"
      class="mt-3 flex flex-wrap gap-1.5"
    >
      <UButton
        label="Passe"
        color="neutral"
        variant="subtle"
        size="lg"
        class="min-w-fit flex-1 justify-center bg-white/10 text-white ring-white/15 hover:bg-white/15"
        @click="emit('bid', 'passe')"
      />
      <UButton
        v-for="contract in contracts"
        :key="contract"
        :label="contractLabels[contract]"
        size="lg"
        :color="contract === 'garde_sans' || contract === 'garde_contre' ? 'warning' : 'primary'"
        :variant="allowed(contract) ? 'solid' : 'subtle'"
        :disabled="!allowed(contract)"
        class="min-w-fit flex-1 justify-center whitespace-nowrap"
        @click="emit('bid', contract)"
      />
    </div>
  </div>
</template>
