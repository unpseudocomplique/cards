<script setup lang="ts">
import type { Contract } from '~~/shared/tarot'

defineProps<{
  disabled?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  bid: [bid: Contract | 'passe']
}>()

const bids: Array<{ value: Contract | 'passe', label: string, tone: string }> = [
  { value: 'passe', label: 'Passe', tone: 'bg-white text-stone-900 hover:bg-stone-100' },
  { value: 'prise', label: 'Prise', tone: 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-300/30 hover:bg-sky-500/30' },
  { value: 'garde', label: 'Garde', tone: 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-300/30 hover:bg-sky-500/30' },
  { value: 'garde_sans', label: 'Garde sans', tone: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-300/30 hover:bg-amber-500/30' },
  { value: 'garde_contre', label: 'Garde contre', tone: 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-300/30 hover:bg-rose-500/30' },
]
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
        Choisissez votre annonce
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="item in bids"
        :key="item.value"
        type="button"
        class="rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
        :class="item.tone"
        :disabled="disabled"
        @click="emit('bid', item.value)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>
