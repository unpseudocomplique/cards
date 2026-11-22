<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'
import { tarotCardLabel } from '~/utils/tarotCardLabel'

const props = withDefaults(defineProps<{
  cardId: CardId
  faceUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  highlighted?: boolean
  dimmed?: boolean
  /** Fill the parent box instead of using a preset height (the parent sets the size). */
  fill?: boolean
  /** Corner index size in px, to scale it with a card sized by its parent. */
  indexPx?: number | null
}>(), {
  faceUrl: null,
  size: 'md',
  highlighted: false,
  dimmed: false,
  fill: false,
  indexPx: null,
})

/**
 * Corner radius of a real card: 5 % of the width (cardRadius in
 * shared/utils/printSpec.ts, same as CardArt), whatever the card size.
 */
const cardCornerRadius = '5% / calc(5% * var(--table-card-ratio, 2 / 3))'

const indexStyle = computed(() => props.indexPx ? { fontSize: `${props.indexPx}px` } : undefined)
const glyphStyle = computed(() => props.indexPx ? { fontSize: `${Math.round(props.indexPx * 2.2)}px` } : undefined)

const label = computed(() => tarotCardLabel(props.cardId))

/*
 * The painted face fades in once loaded; until then the printed index shows,
 * so a card is never a blank white rectangle mid-animation.
 */
const img = ref<HTMLImageElement | null>(null)
const faceLoaded = shallowRef(false)
/** Fade only an image that really arrives late; a cached one shows at once. */
const fadeFace = shallowRef(false)

watch(() => props.faceUrl, () => {
  faceLoaded.value = false
  fadeFace.value = false
  nextTick(() => {
    if (img.value?.complete && img.value.naturalWidth > 0) {
      faceLoaded.value = true
    } else {
      fadeFace.value = true
    }
  })
}, { immediate: true })

const sizeClass = computed(() => {
  if (props.fill) {
    return 'h-full w-full'
  }
  switch (props.size) {
    case 'xs':
      return 'h-16 sm:h-[4.5rem] short:h-14'
    case 'sm':
      return 'h-[5.25rem] sm:h-24 short:h-[4.25rem]'
    case 'lg':
      return 'h-28 sm:h-[9.25rem] short:h-24'
    default:
      return 'h-[6.5rem] sm:h-[9.25rem] short:h-[5.25rem]'
  }
})

const indexTextClass = computed(() => {
  if (props.indexPx) {
    return ''
  }
  switch (props.size) {
    case 'xs':
      return 'text-[0.55rem]'
    case 'sm':
      return 'text-[0.65rem] sm:text-[0.7rem]'
    case 'lg':
      return 'text-[0.8rem] sm:text-[0.9rem]'
    default:
      return 'text-[0.7rem] sm:text-[0.8rem]'
  }
})

const colorClass = computed(() => {
  if (label.value.color === 'red') return 'text-red-700'
  if (label.value.color === 'gold') return 'text-amber-900'
  return 'text-stone-900'
})

const centerGlyph = computed(() => {
  const short = label.value.shortLabel
  if (/[♥♦♣♠]$/.test(short)) {
    return short.slice(-1)
  }
  return short.replace(/[♥♦♣♠]/g, '').slice(0, 2)
})

/** Corner index always shown — critical for custom trump art. */
const indexLabel = computed(() => label.value.shortLabel)
</script>

<template>
  <div
    class="relative shrink-0 overflow-hidden border bg-[#f7f1e6] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.7)]"
    :style="{ aspectRatio: 'var(--table-card-ratio, 2 / 3)', borderRadius: cardCornerRadius }"
    :class="[
      sizeClass,
      highlighted ? 'border-amber-300 ring-2 ring-amber-300/60' : 'border-stone-300/80',
      dimmed ? 'brightness-[0.78] contrast-75' : '',
    ]"
  >
    <div
      v-if="!faceUrl || !faceLoaded"
      class="flex h-full w-full flex-col justify-between px-1.5 py-1.5"
    >
      <div
        class="text-left leading-none font-bold"
        :class="[colorClass, indexTextClass]"
        :style="indexStyle"
      >
        {{ indexLabel }}
      </div>
      <div
        class="text-center leading-none font-bold"
        :class="[colorClass, indexPx ? '' : 'text-2xl sm:text-3xl']"
        :style="glyphStyle"
      >
        {{ centerGlyph }}
      </div>
      <div
        class="self-end rotate-180 text-left leading-none font-bold"
        :class="[colorClass, indexTextClass]"
        :style="indexStyle"
      >
        {{ indexLabel }}
      </div>
    </div>
    <img
      v-if="faceUrl"
      ref="img"
      :src="faceUrl"
      :alt="label.shortLabel"
      class="absolute inset-0 h-full w-full object-cover"
      :class="[faceLoaded ? 'opacity-100' : 'opacity-0', fadeFace ? 'transition-opacity duration-200' : '']"
      draggable="false"
      @load="faceLoaded = true"
    >
  </div>
</template>
