<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'
import { tarotCardLabel } from '~/utils/tarotCardLabel'

const props = withDefaults(defineProps<{
  cardId: CardId
  faceUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  highlighted?: boolean
  dimmed?: boolean
}>(), {
  faceUrl: null,
  size: 'md',
  highlighted: false,
  dimmed: false,
})

const label = computed(() => tarotCardLabel(props.cardId))

const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'h-16 w-11 sm:h-[4.5rem] sm:w-12'
    case 'sm':
      return 'h-[5.25rem] w-[3.5rem] sm:h-24 sm:w-16'
    case 'lg':
      return 'h-28 w-[4.75rem] sm:h-32 sm:w-[5.5rem]'
    default:
      return 'h-[6.5rem] w-[4.35rem] sm:h-[9.25rem] sm:w-[6.25rem]'
  }
})

const colorClass = computed(() => {
  if (label.value.color === 'red') return 'text-red-700'
  if (label.value.color === 'gold') return 'text-amber-800'
  return 'text-stone-900'
})

const centerGlyph = computed(() => {
  const short = label.value.shortLabel
  if (/[♥♦♣♠]$/.test(short)) {
    return short.slice(-1)
  }
  return short.replace(/[♥♦♣♠]/g, '').slice(0, 2)
})
</script>

<template>
  <div
    class="relative overflow-hidden rounded-xl border bg-[#f7f1e6] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.7)]"
    :class="[
      sizeClass,
      highlighted ? 'border-amber-300 ring-2 ring-amber-300/60' : 'border-stone-300/80',
      dimmed ? 'brightness-[0.78] contrast-75' : '',
    ]"
  >
    <img
      v-if="faceUrl"
      :src="faceUrl"
      :alt="label.shortLabel"
      class="h-full w-full object-cover"
      draggable="false"
    >
    <div
      v-else
      class="flex h-full w-full flex-col justify-between px-1.5 py-1.5"
    >
      <div
        class="text-left text-[0.7rem] leading-none font-bold sm:text-[0.8rem]"
        :class="colorClass"
      >
        {{ label.shortLabel }}
      </div>
      <div
        class="text-center text-2xl leading-none font-bold sm:text-3xl"
        :class="colorClass"
      >
        {{ centerGlyph }}
      </div>
      <div
        class="self-end rotate-180 text-left text-[0.7rem] leading-none font-bold sm:text-[0.8rem]"
        :class="colorClass"
      >
        {{ label.shortLabel }}
      </div>
    </div>
  </div>
</template>
