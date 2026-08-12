<script setup lang="ts">
import type { Contract, PublicGameView } from '~~/shared/tarot'

const props = defineProps<{
  disabled?: boolean
  compact?: boolean
  state?: PublicGameView | null
}>()

const emit = defineEmits<{
  bid: [bid: Contract | 'passe']
}>()

const labels: Record<Contract | 'passe', string> = {
  passe: 'Passe',
  prise: 'Prise',
  garde: 'Garde',
  garde_sans: 'Garde sans',
  garde_contre: 'Garde contre',
}

const bids: Array<{ value: Contract | 'passe', label: string, tone: string }> = [
  { value: 'passe', label: 'Passe', tone: 'bg-white text-stone-900 hover:bg-stone-100' },
  { value: 'prise', label: 'Prise', tone: 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-300/30 hover:bg-sky-500/30' },
  { value: 'garde', label: 'Garde', tone: 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-300/30 hover:bg-sky-500/30' },
  { value: 'garde_sans', label: 'Garde sans', tone: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-300/30 hover:bg-amber-500/30' },
  { value: 'garde_contre', label: 'Garde contre', tone: 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-300/30 hover:bg-rose-500/30' },
]

const spoken = computed(() => props.state?.bidSpoken ?? [])

const currentWinner = computed(() => {
  const spokenBids = spoken.value.filter(entry => entry.bid !== 'passe')
  if (!spokenBids.length) {
    return null
  }
  return spokenBids[spokenBids.length - 1]!
})

const minRequired = computed(() => {
  const winner = currentWinner.value
  if (!winner || winner.bid === 'passe') {
    return null
  }
  return winner.bid as Contract
})

function seatName(seat: number) {
  return props.state?.seats[seat]?.name ?? `Siège ${seat + 1}`
}

function isDisabled(value: Contract | 'passe') {
  if (props.disabled) {
    return true
  }
  if (value === 'passe' || !minRequired.value) {
    return false
  }
  const rank: Record<Contract, number> = {
    prise: 1,
    garde: 2,
    garde_sans: 3,
    garde_contre: 4,
  }
  return rank[value] <= rank[minRequired.value]
}
</script>

<template>
  <div
    class="rounded-2xl border border-white/10 bg-black/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md"
    :class="compact ? 'px-3 py-2.5' : 'p-4'"
  >
    <div class="mb-2 flex items-baseline justify-between gap-3">
      <p class="font-semibold text-amber-50">
        Enchères
      </p>
      <p class="text-xs text-white/55">
        <template v-if="currentWinner">
          En cours : <span class="font-semibold text-amber-100">{{ labels[currentWinner.bid] }}</span>
          ({{ seatName(currentWinner.seat) }})
        </template>
        <template v-else>
          Aucune enchère encore
        </template>
      </p>
    </div>

    <div
      v-if="spoken.length"
      class="mb-2 flex flex-wrap gap-1.5"
    >
      <span
        v-for="(entry, index) in spoken"
        :key="`${entry.seat}-${index}`"
        class="rounded-lg px-2 py-0.5 text-[11px] ring-1"
        :class="entry.bid === 'passe'
          ? 'bg-white/5 text-white/55 ring-white/10'
          : 'bg-amber-500/15 text-amber-50 ring-amber-300/25'"
      >
        {{ seatName(entry.seat) }} · {{ labels[entry.bid] }}
      </span>
    </div>

    <p
      v-if="disabled"
      class="mb-2 text-[11px] text-white/45"
    >
      En attente des autres joueurs…
    </p>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="item in bids"
        :key="item.value"
        type="button"
        class="rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
        :class="item.tone"
        :disabled="isDisabled(item.value)"
        @click="emit('bid', item.value)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>
