<script setup lang="ts">
/** One headline number engraved on a brass plate. */
defineProps<{
  label: string
  value: string | number
  detail?: string
  icon?: string
  tone?: 'neutral' | 'good' | 'bad'
}>()
</script>

<template>
  <div class="table-plaque relative flex min-w-0 flex-col rounded-xl px-4 py-3">
    <div class="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-[#e9c77f]/80 uppercase">
      <UIcon
        v-if="icon"
        :name="icon"
        class="size-3.5 shrink-0"
      />
      <span class="truncate">{{ label }}</span>
    </div>
    <p
      class="mt-1 font-display text-4xl leading-none tabular-nums"
      :class="tone === 'good' ? 'text-[#a8e0a0]' : tone === 'bad' ? 'text-[#ff9c8a]' : 'text-[#f6e7c4]'"
    >
      {{ value }}
    </p>
    <p
      v-if="detail"
      class="mt-1.5 truncate text-xs text-[#f6e7c4]/60"
    >
      {{ detail }}
    </p>
  </div>
</template>
