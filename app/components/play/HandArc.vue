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
const { width: rawWidth, height: rawHeight } = useWindowSize()
const viewportWidth = computed(() => Number.isFinite(rawWidth.value) && rawWidth.value > 0 ? rawWidth.value : 390)
const viewportHeight = computed(() => Number.isFinite(rawHeight.value) && rawHeight.value > 0 ? rawHeight.value : 844)
/** Landscape phones: wide enough for desktop sizes, but very little height. */
const isShort = computed(() => viewportHeight.value <= 520)
/** Phone held upright: narrow and tall. */
const isPortrait = computed(() => viewportWidth.value / viewportHeight.value < 0.85)
const prefersReduced = usePreferredReducedMotion()
const legalSet = computed(() => new Set(props.legalMoves))
/** Hide immediately on click so the flight clone is the only visible card. */
const pendingPlay = shallowRef<CardId | null>(null)

const sortedCards = computed(() => sortHand(props.cards))

const visibleCards = computed(() =>
  sortedCards.value.filter(card => card !== pendingPlay.value),
)

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Card height in px, from the space the screen really has: small on landscape
 * phones so the table stays visible, a bit taller on upright phones where the
 * hand has the full width below the table.
 */
const cardHeight = computed(() => {
  if (isShort.value) {
    return clamp(Math.round(viewportHeight.value * 0.28), 80, 120)
  }
  if (isPortrait.value) {
    return clamp(Math.round(viewportHeight.value * 0.175), 112, 156)
  }
  return isMobile.value ? 104 : 148
})
const cardWidth = computed(() => cardHeight.value * 0.7)
/** Index size on the faces. */
const cardSize = computed<'sm' | 'md'>(() => cardHeight.value < 100 ? 'sm' : 'md')
/** Phones: the cards overlap a lot, so only the corner index shows; make it big. */
const isPhone = computed(() => isPortrait.value || isShort.value)
const indexPx = computed(() => isPhone.value ? Math.round(cardHeight.value * 0.13) : null)

/** Above this many cards the hand is laid out on two rows so it stays on screen. */
const rowThreshold = computed(() => {
  if (isShort.value) {
    // Landscape phones have width but no height: keep one row while each card
    // still shows its index (about 40% of a card).
    const maxSpread = Math.max(0, viewportWidth.value - cardWidth.value - 28)
    return Math.max(9, Math.floor(maxSpread / (cardWidth.value * 0.36)) + 1)
  }
  return isMobile.value ? 9 : 12
})

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
/** How much of the back row shows above the front row (its index and face). */
const rowLift = computed(() => twoRows.value ? Math.round(cardHeight.value * 0.46) : 0)

/** Room under the fan for the lower corners of the most rotated cards. */
const rotationOverhang = computed(() => {
  const maxArc = isPhone.value ? 7 : isMobile.value ? 26 : 32
  return Math.round((cardHeight.value * 0.35) * Math.sin((maxArc * Math.PI) / 180))
})

/** Height reserved for the fan; tight on phones so the table keeps the rest. */
const handHeight = computed(() => {
  if (isShort.value || isPortrait.value) {
    return `${cardHeight.value + rowLift.value + rotationOverhang.value + 24}px`
  }
  return `calc(${isMobile.value ? 'min(30vh, 240px)' : 'min(34vh, 280px)'} + ${rowLift.value}px)`
})

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
  const vw = viewportWidth.value

  // Phones: a flat fan over the full width, so every corner index stays upright and visible.
  const arc = isPhone.value
    ? 7
    : isMobile.value
      ? (hovered.value ? 26 : 16)
      : (hovered.value ? 32 : 20)
  // Never wider than the viewport minus one card, so edge cards stay visible.
  const maxSpread = Math.max(0, vw - cardWidth.value - (isPhone.value ? 28 : 48))
  const spread = isPhone.value
    ? Math.min(maxSpread, (total - 1) * cardWidth.value * 0.8)
    : Math.min(maxSpread, isMobile.value
        ? (hovered.value ? 70 + total * 28 : 52 + total * 24)
        : (hovered.value ? Math.min(1180, 120 + total * 52) : Math.min(980, 90 + total * 46)))
  const yOffset = isPhone.value
    ? 5
    : isMobile.value
      ? (hovered.value ? 14 : 8)
      : (hovered.value ? 22 : 10)

  const rotate = t * arc
  const x = t * (spread / 2)
  // Raise the middle instead of dropping the ends, so edge cards stay on screen.
  const y = (Math.abs(t) - 1) * yOffset
  const playableBoost = props.dimUnplayable && isPlayable(card)
    ? (isMobile.value ? -10 : -16)
    : 0
  const scale = !isPhone.value && hovered.value && Math.abs(dist) < 0.75 ? 1.06 : 1

  // Back row sits behind the front row; playable cards rise within their row.
  const rowBase = backRow ? 0 : 100
  // Phones: stack left to right like a hand of cards, so every top-left index shows.
  const zIndex = isPhone.value
    ? rowBase + index
    : rowBase + (isPlayable(card) ? 50 : 0) + 40 - Math.abs(Math.round(dist * 2))

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
    :style="{
      height: handHeight,
      paddingBottom: `${rotationOverhang}px`
    }"
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
        class="pointer-events-none absolute left-1/2 z-[300] flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-300 px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap text-neutral-950 short:py-1 short:text-xs shadow-lg shadow-black/40"
        :style="{ bottom: `${cardHeight + rowLift + rotationOverhang + (isShort ? 16 : 34)}px` }"
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
            :index-px="indexPx"
            fill
            :highlighted="isPlayable(card) && !!dimUnplayable"
            :dimmed="shouldDim(card)"
          />
        </motion.button>
      </AnimatePresence>
    </div>
  </div>
</template>
