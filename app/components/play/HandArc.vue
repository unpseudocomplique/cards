<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { cardSuit as tarotSuit, sortHand, type CardId } from '~~/shared/tarot'

const props = defineProps<{
  cards: CardId[]
  legalMoves: CardId[]
  faceUrls: Map<string, string | null> | Record<string, string | null>
  backUrl?: string | null
  dimUnplayable?: boolean
  disabled?: boolean
  /** Short hint shown above the hand (e.g. "À vous de jouer"). */
  prompt?: string | null
}>()

const emit = defineEmits<{
  play: [card: CardId, origin: DOMRect]
}>()

const hovered = shallowRef(false)
const isMobile = useMediaQuery('(max-width: 640px)')
/** Landscape phones: wide enough for desktop sizes, but very little height. */
const isShort = useMediaQuery('(max-height: 520px)')
const { width: viewportWidth } = useWindowSize()
const prefersReduced = usePreferredReducedMotion()
const legalSet = computed(() => new Set(props.legalMoves))
/** Hide immediately on click so the flight clone is the only visible card. */
const pendingPlay = shallowRef<CardId | null>(null)

const sortedCards = computed(() => sortHand(props.cards))

const visibleCards = computed(() =>
  sortedCards.value.filter(card => card !== pendingPlay.value),
)

/** Above this many cards the hand is laid out on two rows so it stays on screen. */
const rowThreshold = computed(() => isMobile.value ? 9 : 12)

/**
 * Split the sorted hand in two rows, preferably between two suits so each
 * suit stays together. Back row = first half (trumps first), front row = rest.
 */
const rows = computed<CardId[][]>(() => {
  const cards = visibleCards.value
  if (cards.length <= rowThreshold.value) {
    return [cards]
  }
  const target = Math.ceil(cards.length / 2)
  let split = target
  let best = Infinity
  for (let index = 1; index < cards.length; index++) {
    if (tarotSuit(cards[index]!) === tarotSuit(cards[index - 1]!)) {
      continue
    }
    const distance = Math.abs(index - target)
    const fits = index <= rowThreshold.value && cards.length - index <= rowThreshold.value
    if (distance <= 2 && fits && distance < best) {
      best = distance
      split = index
    }
  }
  return [cards.slice(0, split), cards.slice(split)]
})

const twoRows = computed(() => rows.value.length > 1)
/** Smaller cards when two rows must fit in a short (landscape phone) screen. */
const cardSize = computed<'sm' | 'md'>(() => twoRows.value && isShort.value ? 'sm' : 'md')
const cardHeight = computed(() => cardSize.value === 'sm'
  ? (isMobile.value ? 84 : 96)
  : (isMobile.value ? 104 : 148))
/** How much of the back row shows above the front row (its index and face). */
const rowLift = computed(() => twoRows.value ? Math.round(cardHeight.value * 0.46) : 0)

const placements = computed(() => {
  const map = new Map<CardId, { row: number, index: number, total: number }>()
  rows.value.forEach((row, rowIndex) => {
    row.forEach((card, index) => map.set(card, { row: rowIndex, index, total: row.length }))
  })
  return map
})

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

function cardMotion(card: CardId) {
  const place = placements.value.get(card) ?? { row: 0, index: 0, total: 1 }
  const { index, total } = place
  const backRow = twoRows.value && place.row === 0
  const mid = (total - 1) / 2
  const dist = index - mid
  const t = total <= 1 ? 0 : dist / Math.max(mid, 1)
  const vw = viewportWidth.value || 390

  const arc = isMobile.value
    ? (hovered.value ? 26 : 16)
    : (hovered.value ? 32 : 20)
  // Never wider than the viewport minus one card, so edge cards stay visible.
  const cardWidth = cardHeight.value * 0.7
  const maxSpread = Math.max(0, vw - cardWidth - 48)
  const spread = Math.min(maxSpread, isMobile.value
    ? (hovered.value ? 70 + total * 28 : 52 + total * 24)
    : (hovered.value ? Math.min(1180, 120 + total * 52) : Math.min(980, 90 + total * 46)))
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

  // Back row sits behind the front row; playable cards rise within their row.
  const rowBase = backRow ? 0 : 100
  const zIndex = rowBase + (isPlayable(card) ? 50 : 0) + 40 - Math.abs(Math.round(dist * 2))

  return {
    x,
    y: y + playableBoost - (backRow ? rowLift.value : 0),
    rotate,
    scale,
    opacity: 1,
    zIndex,
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
    class="pointer-events-auto relative z-20 mx-auto flex w-full max-w-6xl items-end justify-center px-1 pb-1"
    :style="{ height: `calc(${isMobile ? 'min(30vh, 240px)' : 'min(34vh, 280px)'} + ${rowLift}px)` }"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-2 opacity-0"
    >
      <p
        v-if="prompt"
        class="pointer-events-none absolute left-1/2 z-[300] flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-300 px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap text-neutral-950 shadow-lg shadow-black/40"
        :style="{ bottom: `${cardHeight + rowLift + 34}px` }"
        role="status"
      >
        <UIcon
          name="i-lucide-hand"
          class="size-4"
        />
        {{ prompt }}
      </p>
    </Transition>
    <div
      class="relative mb-1 shrink-0"
      :style="{ height: `${cardHeight}px`, aspectRatio: 'var(--table-card-ratio, 2 / 3)' }"
    >
      <AnimatePresence>
        <motion.button
          v-for="card in visibleCards"
          :key="card"
          type="button"
          class="absolute inset-0 origin-bottom touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          :class="isPlayable(card)
            ? 'pointer-events-auto cursor-pointer'
            : 'pointer-events-none cursor-default'"
          :initial="prefersReduced ? false : { opacity: 0, y: 24, scale: 0.92 }"
          :animate="cardMotion(card)"
          :exit="prefersReduced
            ? { opacity: 0 }
            : { opacity: 0, scale: 0.92, transition: { duration: 0.15 } }"
          :transition="spring"
          :style="{ zIndex: cardMotion(card).zIndex }"
          :disabled="!isPlayable(card)"
          :aria-label="card"
          @click.stop="onPlay(card, $event)"
        >
          <PlayDeckCard
            :card-id="card"
            :face-url="faceUrlFor(card)"
            :size="cardSize"
            :highlighted="isPlayable(card) && !!dimUnplayable"
            :dimmed="shouldDim(card)"
          />
        </motion.button>
      </AnimatePresence>
    </div>
  </div>
</template>
