<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import type { CardId } from '~~/shared/tarot'

const props = defineProps<{
  trick: Array<{ seat: number, card: CardId }>
  faceUrls: Map<string, string | null> | Record<string, string | null>
  seats?: Array<{ name: string | null } | null>
}>()

const prefersReduced = usePreferredReducedMotion()

function faceUrlFor(card: CardId): string | null {
  const urls = props.faceUrls
  if (urls instanceof Map) {
    return urls.get(card) ?? null
  }
  return urls[card] ?? null
}

const spring = computed(() =>
  prefersReduced.value
    ? { type: 'tween' as const, duration: 0.01 }
    : { type: 'spring' as const, stiffness: 320, damping: 24, mass: 0.7 },
)

function tilt(seat: number) {
  return ((seat % 5) - 2) * 4
}
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center px-3 pb-[18vh] sm:pb-[14vh]">
    <div class="flex max-w-full items-end justify-center gap-1.5 sm:gap-3">
      <AnimatePresence mode="popLayout">
        <motion.div
          v-for="(entry, index) in trick"
          :key="`${entry.seat}-${entry.card}`"
          class="relative"
          :initial="prefersReduced ? false : { opacity: 0, y: -28, scale: 0.86, rotate: tilt(entry.seat) - 8 }"
          :animate="{ opacity: 1, y: 0, scale: 1, rotate: tilt(entry.seat) }"
          :exit="{ opacity: 0, y: 16, scale: 0.9 }"
          :transition="spring"
          :style="{ zIndex: index + 1 }"
        >
          <PlayDeckCard
            :card-id="entry.card"
            :face-url="faceUrlFor(entry.card)"
            size="sm"
          />
          <p
            v-if="seats?.[entry.seat]?.name"
            class="mt-1 max-w-[4.5rem] truncate text-center text-[10px] text-white/70 sm:text-xs"
          >
            {{ seats[entry.seat]?.name }}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  </div>
</template>
