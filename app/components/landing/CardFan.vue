<script setup lang="ts">
import { motion } from 'motion-v'

const reducedMotion = usePreferredReducedMotion()
const prefersReduced = computed(() => reducedMotion.value === 'reduce')
const hovered = shallowRef(false)

const cards = [
  { suit: '♠', rank: 'R', rotate: -18, x: -72, y: 18, z: 1 },
  { suit: '♥', rank: 'D', rotate: -8, x: -35, y: 6, z: 2 },
  { suit: '✦', rank: 'XXI', rotate: 0, x: 0, y: 0, z: 3 },
  { suit: '♣', rank: 'C', rotate: 8, x: 35, y: 6, z: 2 },
  { suit: '♦', rank: 'V', rotate: 18, x: 72, y: 18, z: 1 }
] as const

const spread = computed(() => (hovered.value && !prefersReduced.value ? 1.34 : 1))

function cardAnimate(card: typeof cards[number]) {
  const open = hovered.value && !prefersReduced.value

  return {
    opacity: 1,
    x: card.x * spread.value,
    y: card.y * spread.value - (open ? 10 : 0),
    rotate: card.rotate * (open ? 1.2 : 1),
    scale: open ? 1.04 : 1
  }
}
</script>

<template>
  <div
    class="relative mx-auto grid h-[18rem] w-full max-w-[18rem] place-items-center sm:h-[22rem] sm:max-w-[22rem] md:h-[26rem] md:max-w-[26rem]"
    aria-hidden="true"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <motion.div
      v-if="!prefersReduced"
      class="pointer-events-none absolute size-52 rounded-full bg-gold-500/22 blur-3xl sm:size-64"
      :initial="{ opacity: 0, scale: 0.8 }"
      :animate="{ opacity: [0.4, 0.85, 0.4], scale: [1, 1.16, 1] }"
      :transition="{ duration: 5.2, repeat: Infinity, ease: 'easeInOut', delay: 0.35 }"
    />

    <div class="relative h-44 w-28 sm:h-52 sm:w-36 md:h-60 md:w-40">
      <motion.div
        v-for="(card, index) in cards"
        :key="`${card.suit}-${card.rank}`"
        class="absolute inset-0 origin-bottom"
        :style="{ zIndex: card.z }"
        :initial="prefersReduced
          ? false
          : { opacity: 0, x: 0, y: 56, rotate: 0, scale: 0.86 }"
        :animate="cardAnimate(card)"
        :transition="{
          type: 'spring',
          stiffness: hovered ? 240 : 160,
          damping: hovered ? 16 : 18,
          delay: prefersReduced || hovered ? 0 : 0.16 + index * 0.08
        }"
      >
        <div
          class="card-idle relative h-full w-full"
          :style="{ '--card-delay': `${index * 0.55}s` }"
        >
          <div class="card-face relative h-full w-full overflow-hidden rounded-[1.1rem] bg-gradient-to-b from-ink-50 to-ink-100 shadow-[0_18px_40px_-18px_oklch(0.2_0.04_40_/_0.7)] ring-1 ring-gold-700/25 dark:from-ink-800 dark:to-ink-900">
            <div class="absolute inset-[5px] rounded-[0.85rem] border border-gold-700/35 bg-[linear-gradient(180deg,oklch(0.45_0.08_38)_0%,oklch(0.28_0.05_28)_100%)] p-3 text-gold-100">
              <div class="flex items-start justify-between text-sm font-semibold tracking-wide">
                <span>{{ card.rank }}</span>
                <span>{{ card.suit }}</span>
              </div>
              <div class="grid h-[calc(100%-2rem)] place-items-center font-serif text-3xl text-gold-200/90 sm:text-4xl">
                {{ card.rank === 'XXI' ? 'XXI' : card.suit }}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .card-idle {
    animation: card-idle 4.6s ease-in-out infinite;
    animation-delay: var(--card-delay, 0s);
  }

  .card-face::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      115deg,
      transparent 38%,
      oklch(0.92 0.08 82 / 0.22) 50%,
      transparent 62%
    );
    transform: translateX(-140%);
    animation: card-shine 7.2s ease-in-out infinite;
    animation-delay: var(--card-delay, 0s);
    pointer-events: none;
  }
}

@keyframes card-idle {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  40% {
    transform: translateY(-11px) rotate(1.4deg);
  }
  70% {
    transform: translateY(-5px) rotate(-0.8deg);
  }
}

@keyframes card-shine {
  0%,
  58%,
  100% {
    transform: translateX(-140%);
  }
  72% {
    transform: translateX(140%);
  }
}
</style>
