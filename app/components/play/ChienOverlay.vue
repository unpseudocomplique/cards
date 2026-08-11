<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import type { CardId } from '~~/shared/tarot'

const props = defineProps<{
  cards: CardId[]
  faceUrls: Map<string, string | null> | Record<string, string | null>
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
    : { type: 'spring' as const, stiffness: 280, damping: 26 },
)
</script>

<template>
  <div class="pointer-events-none absolute inset-x-0 top-[18%] z-[14] flex justify-center px-3 sm:top-[16%]">
    <div class="rounded-2xl border border-white/10 bg-black/35 px-2 py-2 backdrop-blur-sm sm:px-3">
      <p class="mb-1.5 text-center text-[10px] tracking-wide text-white/55 uppercase sm:text-xs">
        Chien
      </p>
      <div class="flex items-center justify-center gap-1 sm:gap-2">
        <AnimatePresence>
          <motion.div
            v-for="(card, index) in cards"
            :key="card"
            :initial="prefersReduced ? false : { opacity: 0, y: -12, scale: 0.9 }"
            :animate="{ opacity: 1, y: 0, scale: 1 }"
            :transition="{ ...spring, delay: index * 0.04 }"
          >
            <PlayDeckCard
              :card-id="card"
              :face-url="faceUrlFor(card)"
              size="xs"
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  </div>
</template>
