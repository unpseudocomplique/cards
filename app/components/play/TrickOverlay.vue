<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import type { CardId } from '~~/shared/tarot'
import { seatAnchor } from '~/utils/seatLayout'

export type TrickEntry = { seat: number, card: CardId }

const props = defineProps<{
  trick: TrickEntry[]
  faceUrls: Map<string, string | null> | Record<string, string | null>
  seats?: Array<{ name: string | null } | null>
  localSeat: number
  playerCount: 3 | 4 | 5
  sceneWidth: number
  sceneHeight: number
  /** Winner seat while collecting the trick toward their pile. */
  collectingToSeat?: number | null
  winnerName?: string | null
}>()

const prefersReduced = usePreferredReducedMotion()

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
  const target = seatAnchor(
    props.collectingToSeat,
    props.localSeat,
    props.playerCount,
    props.sceneWidth,
    props.sceneHeight,
  )
  const centerX = props.sceneWidth / 2
  const centerY = props.sceneHeight * 0.42
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
  <div class="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center px-3 pb-[18vh] sm:pb-[14vh]">
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
          <PlayDeckCard
            :card-id="entry.card"
            :face-url="faceUrlFor(entry.card)"
            size="sm"
          />
          <p
            v-if="seats?.[entry.seat]?.name && collectingToSeat == null"
            class="mt-1 max-w-[4.5rem] truncate text-center text-[10px] text-white/70 sm:text-xs"
          >
            {{ seats[entry.seat]?.name }}
          </p>
        </motion.div>
      </AnimatePresence>

      <motion.div
        v-if="collectingToSeat != null && winnerName"
        class="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-full border border-amber-200/30 bg-black/70 px-3 py-1 text-xs font-semibold tracking-wide text-amber-100 uppercase"
        :initial="{ opacity: 0, y: 8, scale: 0.9 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :transition="{ type: 'spring', stiffness: 320, damping: 22 }"
      >
        Pli pour {{ winnerName }}
      </motion.div>
    </div>
  </div>
</template>
