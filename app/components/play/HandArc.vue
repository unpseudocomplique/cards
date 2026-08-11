<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import type { CardId } from '~~/shared/tarot'

const props = defineProps<{
  cards: CardId[]
  legalMoves: CardId[]
  faceUrls: Map<string, string | null> | Record<string, string | null>
  backUrl?: string | null
  dimUnplayable?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  play: [card: CardId]
}>()

const hovered = shallowRef(false)
const isMobile = useMediaQuery('(max-width: 640px)')
const { width: viewportWidth } = useWindowSize()
const prefersReduced = usePreferredReducedMotion()
const legalSet = computed(() => new Set(props.legalMoves))

function faceUrlFor(card: CardId): string | null {
  const urls = props.faceUrls
  if (urls instanceof Map) {
    return urls.get(card) ?? null
  }
  return urls[card] ?? null
}

function isPlayable(card: CardId) {
  return !props.disabled && legalSet.value.has(card)
}

function shouldDim(card: CardId) {
  return !!props.dimUnplayable && !isPlayable(card)
}

function cardMotion(index: number, total: number) {
  const mid = (total - 1) / 2
  const dist = index - mid
  const t = total <= 1 ? 0 : dist / Math.max(mid, 1)
  const vw = viewportWidth.value || 390

  const arc = isMobile.value
    ? (hovered.value ? 26 : 16)
    : (hovered.value ? 32 : 20)
  const spread = isMobile.value
    ? (hovered.value
        ? Math.min(vw - 48, 70 + total * 28)
        : Math.min(vw - 64, 52 + total * 24))
    : (hovered.value
        ? Math.min(1180, 120 + total * 52)
        : Math.min(980, 90 + total * 46))
  const yOffset = isMobile.value
    ? (hovered.value ? 14 : 8)
    : (hovered.value ? 22 : 10)

  const rotate = t * arc
  const x = t * (spread / 2)
  const y = Math.abs(t) * yOffset
  const playableBoost = props.dimUnplayable && isPlayable(props.cards[index]!)
    ? (isMobile.value ? -10 : -16)
    : 0
  const scale = hovered.value && Math.abs(dist) < 0.75 ? 1.06 : 1

  return {
    x,
    y: y + playableBoost,
    rotate,
    scale,
    opacity: 1,
    zIndex: 40 - Math.abs(Math.round(dist * 2)),
  }
}

const spring = computed(() =>
  prefersReduced.value
    ? { type: 'tween' as const, duration: 0.01 }
    : { type: 'spring' as const, stiffness: 180, damping: 20, mass: 0.8 },
)

function onPlay(card: CardId) {
  if (!isPlayable(card)) {
    return
  }
  emit('play', card)
}
</script>

<template>
  <div
    class="pointer-events-auto relative mx-auto flex h-[min(30vh,240px)] w-full max-w-6xl items-end justify-center overflow-x-auto overflow-y-visible overscroll-x-contain px-1 pb-1 touch-pan-x sm:h-[min(34vh,280px)] sm:overflow-visible sm:touch-auto"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <div class="relative mb-1 h-[6.5rem] w-[4.35rem] shrink-0 sm:h-[9.25rem] sm:w-[6.25rem]">
      <AnimatePresence>
        <motion.button
          v-for="(card, index) in cards"
          :key="card"
          type="button"
          class="absolute inset-0 origin-bottom touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          :class="isPlayable(card) ? 'cursor-pointer' : 'cursor-default'"
          :initial="prefersReduced ? false : { opacity: 0, y: 24, scale: 0.92 }"
          :animate="cardMotion(index, cards.length)"
          :exit="{ opacity: 0, y: 18, scale: 0.9 }"
          :transition="spring"
          :style="{ zIndex: cardMotion(index, cards.length).zIndex }"
          :disabled="!isPlayable(card)"
          :aria-label="card"
          @click="onPlay(card)"
        >
          <PlayDeckCard
            :card-id="card"
            :face-url="faceUrlFor(card)"
            size="md"
            :highlighted="isPlayable(card) && !!dimUnplayable"
            :dimmed="shouldDim(card)"
          />
        </motion.button>
      </AnimatePresence>
    </div>
  </div>
</template>
