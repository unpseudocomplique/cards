<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import type { CardId } from '~~/shared/tarot'
import { trickCardHeight as trickCardHeightFor, trickZone, wonPileAnchor } from '~/utils/seatLayout'

export type TrickEntry = { seat: number, card: CardId }

const props = defineProps<{
  trick: TrickEntry[]
  faceUrls: Map<string, string | null> | Record<string, string | null>
  seats?: Array<{ name: string | null } | null>
  localSeat: number
  playerCount: 3 | 4 | 5
  sceneWidth: number
  sceneHeight: number
  mobile?: boolean
  /** Winner seat while collecting the trick toward their pile. */
  collectingToSeat?: number | null
  winnerName?: string | null
  /** Shown while the finished trick is held before collect. */
  holdBanner?: string | null
}>()

const prefersReduced = usePreferredReducedMotion()

/** Phones: trick cards sized from the screen (see seatLayout's trickCardHeight). */
const trickCardHeight = computed(() =>
  trickCardHeightFor({ width: props.sceneWidth, height: props.sceneHeight }, props.playerCount))

/** "Title — reason" from the table: title in bold, reason smaller below. */
const bannerParts = computed(() => {
  const [title, ...rest] = (props.holdBanner ?? '').split(' — ')
  return { title, reason: rest.join(' — ') }
})

function seatLabel(seat: number) {
  return seat === props.localSeat ? 'Vous' : props.seats?.[seat]?.name
}

function faceUrlFor(card: CardId): string | null {
  const urls = props.faceUrls
  if (urls instanceof Map) {
    return urls.get(card) ?? null
  }
  return urls[card] ?? null
}

function tilt(seat: number) {
  return ((seat % 5) - 2) * 4
}

function collectOffset(seat: number) {
  if (props.collectingToSeat == null || props.sceneWidth <= 0) {
    return { x: 0, y: 0, scale: 1, opacity: 1 }
  }
  const view = { width: props.sceneWidth, height: props.sceneHeight, mobile: props.mobile ?? false }
  // Fly to the winner's pile on the felt (the local player's tricks go to the hand).
  const target = wonPileAnchor(props.collectingToSeat, props.localSeat, props.playerCount, view)
  const zone = trickZone(view, props.playerCount)
  const centerX = zone.centerX
  const centerY = zone.centerY
  return {
    x: target.x - centerX + (seat - props.collectingToSeat) * 6,
    y: target.y - centerY,
    scale: 0.45,
    opacity: 0.15,
  }
}

const spring = computed(() =>
  prefersReduced.value
    ? { type: 'tween' as const, duration: 0.01 }
    : { type: 'spring' as const, stiffness: 280, damping: 18, mass: 0.7 },
)
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center px-3 pb-[18vh] sm:pb-[14vh] upright:pb-[8vh] short:pb-[21vh]">
    <div class="relative flex max-w-full items-end justify-center gap-1.5 sm:gap-3">
      <AnimatePresence>
        <motion.div
          v-for="(entry, index) in trick"
          :key="`${entry.seat}-${entry.card}`"
          class="relative"
          :initial="prefersReduced ? false : { opacity: 0, y: 96, scale: 0.7, rotate: tilt(entry.seat) - 16 }"
          :animate="{
            opacity: collectOffset(entry.seat).opacity,
            x: collectOffset(entry.seat).x,
            y: collectOffset(entry.seat).y,
            scale: collectOffset(entry.seat).scale,
            rotate: collectingToSeat != null ? tilt(entry.seat) * 0.3 : tilt(entry.seat),
          }"
          :exit="{ opacity: 0, scale: 0.5 }"
          :transition="collectingToSeat != null
            ? { type: 'spring', stiffness: 220, damping: 20, mass: 0.85 }
            : spring"
          :style="{ zIndex: index + 1 }"
        >
          <div
            v-if="trickCardHeight"
            :style="{ height: `${trickCardHeight}px`, aspectRatio: 'var(--table-card-ratio, 2 / 3)' }"
          >
            <PlayDeckCard
              :card-id="entry.card"
              :face-url="faceUrlFor(entry.card)"
              size="md"
              fill
              :index-px="Math.max(13, Math.round(trickCardHeight * 0.12))"
            />
          </div>
          <PlayDeckCard
            v-else
            :card-id="entry.card"
            :face-url="faceUrlFor(entry.card)"
            size="sm"
          />
          <p
            v-if="seatLabel(entry.seat) && collectingToSeat == null"
            class="mx-auto mt-1 w-fit max-w-[4.5rem] truncate rounded-full bg-black/55 px-1.5 py-px text-center text-[10px] text-white/85 backdrop-blur-sm sm:text-xs"
          >
            {{ seatLabel(entry.seat) }}
          </p>
        </motion.div>
      </AnimatePresence>

      <motion.div
        v-if="collectingToSeat != null && winnerName"
        class="pointer-events-none absolute -top-10 left-1/2 upright:top-auto upright:-bottom-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-200/30 bg-black/70 px-3 py-1 text-xs font-semibold tracking-wide text-amber-100 uppercase"
        :initial="{ opacity: 0, y: 8, scale: 0.9 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :transition="{ type: 'spring', stiffness: 320, damping: 22 }"
      >
        Pli pour {{ winnerName }}
      </motion.div>
      <motion.div
        v-else-if="holdBanner"
        class="pointer-events-none absolute -top-14 left-1/2 w-max max-w-[min(20rem,90vw)] -translate-x-1/2 rounded-2xl border border-white/15 bg-neutral-950/85 px-3.5 py-1.5 text-center shadow-xl backdrop-blur-md upright:top-auto upright:-bottom-14"
        :initial="{ opacity: 0, y: 8, scale: 0.96 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :transition="{ type: 'spring', stiffness: 300, damping: 22 }"
      >
        <p class="font-display text-lg leading-tight text-amber-50">
          {{ bannerParts.title }}
        </p>
        <p
          v-if="bannerParts.reason"
          class="text-[11px] leading-snug text-white/60"
        >
          {{ bannerParts.reason }}
        </p>
      </motion.div>
    </div>
  </div>
</template>
