<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { sortHand, type CardId } from '~~/shared/tarot'

const props = defineProps<{
  cards: CardId[]
  legalMoves: CardId[]
  faceUrls: Map<string, string | null> | Record<string, string | null>
  backUrl?: string | null
  dimUnplayable?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  play: [card: CardId, origin: DOMRect]
}>()

const hovered = shallowRef(false)
const isMobile = useMediaQuery('(max-width: 640px)')
const { width: viewportWidth } = useWindowSize()
const prefersReduced = usePreferredReducedMotion()
const legalSet = computed(() => new Set(props.legalMoves))
/** Hide immediately on click so the flight clone is the only visible card. */
const pendingPlay = shallowRef<CardId | null>(null)

const sortedCards = computed(() => sortHand(props.cards))

const visibleCards = computed(() =>
  sortedCards.value.filter(card => card !== pendingPlay.value),
)

watch(() => props.cards, (cards) => {
  if (pendingPlay.value && !cards.includes(pendingPlay.value)) {
    pendingPlay.value = null
  }
})

watch(pendingPlay, (card) => {
  if (!card) {
    return
  }
  const played = card
  const timer = setTimeout(() => {
    // Restore if the server rejected the play and the card is still in hand.
    if (pendingPlay.value === played && props.cards.includes(played)) {
      pendingPlay.value = null
    }
  }, 2_000)
  onWatcherCleanup(() => clearTimeout(timer))
})

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

function cardMotion(index: number, total: number, card: CardId) {
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
  const playableBoost = props.dimUnplayable && isPlayable(card)
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

function onPlay(card: CardId, event: MouseEvent) {
  if (!isPlayable(card) || pendingPlay.value) {
    return
  }
  const target = event.currentTarget
  let origin: DOMRect
  if (target instanceof HTMLElement) {
    origin = target.getBoundingClientRect()
  }
  else {
    origin = new DOMRect(window.innerWidth / 2 - 35, window.innerHeight - 180, 70, 105)
  }
  // If motion leaves a zero box, fall back to a visible hand-area rect.
  if (origin.width < 8 || origin.height < 8) {
    origin = new DOMRect(window.innerWidth / 2 - 35, window.innerHeight - 180, 70, 105)
  }
  pendingPlay.value = card
  emit('play', card, origin)
}
</script>

<template>
  <div
    class="pointer-events-auto relative z-20 mx-auto flex h-[min(30vh,240px)] w-full max-w-6xl items-end justify-center overflow-x-auto overflow-y-visible overscroll-x-contain px-1 pb-1 touch-pan-x sm:h-[min(34vh,280px)] sm:overflow-visible sm:touch-auto"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <div class="relative mb-1 h-[6.5rem] w-[4.35rem] shrink-0 sm:h-[9.25rem] sm:w-[6.25rem]">
      <AnimatePresence>
        <motion.button
          v-for="(card, index) in visibleCards"
          :key="card"
          type="button"
          class="absolute inset-0 origin-bottom touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          :class="isPlayable(card)
            ? 'pointer-events-auto cursor-pointer'
            : 'pointer-events-none cursor-default'"
          :initial="prefersReduced ? false : { opacity: 0, y: 24, scale: 0.92 }"
          :animate="cardMotion(index, visibleCards.length, card)"
          :exit="prefersReduced
            ? { opacity: 0 }
            : { opacity: 0, scale: 0.92, transition: { duration: 0.15 } }"
          :transition="spring"
          :style="{ zIndex: isPlayable(card)
            ? 80 + index
            : cardMotion(index, visibleCards.length, card).zIndex }"
          :disabled="!isPlayable(card)"
          :aria-label="card"
          @click.stop="onPlay(card, $event)"
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
