<script setup lang="ts">
/**
 * Horizontal bars, one per line: a share (0..1) drawn as a brass gauge, with
 * the value and a detail written beside it in ink, never in the bar colour.
 */
defineProps<{
  rows: Array<{ key: string, label: string, value: number, text: string, detail?: string, muted?: boolean }>
}>()
</script>

<template>
  <ul class="space-y-2.5">
    <li
      v-for="row in rows"
      :key="row.key"
      class="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm"
      :class="row.muted ? 'opacity-45' : ''"
      :title="row.detail ? `${row.label} : ${row.text} · ${row.detail}` : `${row.label} : ${row.text}`"
    >
      <span class="truncate text-[#f6e7c4]/80">{{ row.label }}</span>
      <span class="relative h-2.5 overflow-hidden rounded-full bg-[#1c0f07]/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
        <span
          class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#a9793a] to-[#f0d08a]"
          :style="{ width: `${Math.max(row.value > 0 ? 3 : 0, Math.min(100, row.value * 100))}%` }"
        />
      </span>
      <span class="text-right">
        <span class="font-semibold text-[#f6e7c4] tabular-nums">{{ row.text }}</span>
        <span
          v-if="row.detail"
          class="ml-1.5 text-xs text-[#f6e7c4]/50 tabular-nums"
        >{{ row.detail }}</span>
      </span>
    </li>
  </ul>
</template>
