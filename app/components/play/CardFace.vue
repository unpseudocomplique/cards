<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'
import { tarotCardLabel } from '~/utils/tarotCardLabel'

const props = defineProps<{
  cardId: CardId
  size?: 'sm' | 'md' | 'lg'
}>()

const label = computed(() => tarotCardLabel(props.cardId))

const colorClass = computed(() => {
  switch (label.value.color) {
    case 'red':
      return 'text-red-600 dark:text-red-400'
    case 'gold':
      return 'text-amber-600 dark:text-amber-400'
    default:
      return 'text-neutral-900 dark:text-neutral-100'
  }
})

const sizeClass = computed(() => {
  switch (props.size ?? 'md') {
    case 'sm':
      return 'h-14 w-10 text-xs'
    case 'lg':
      return 'h-24 w-16 text-base'
    default:
      return 'h-20 w-14 text-sm'
  }
})
</script>

<template>
  <div
    class="inline-flex shrink-0 items-center justify-center rounded-lg border border-default bg-white font-semibold shadow-sm dark:bg-neutral-900"
    :class="[sizeClass, colorClass]"
    :aria-label="label.shortLabel"
  >
    {{ label.shortLabel }}
  </div>
</template>
