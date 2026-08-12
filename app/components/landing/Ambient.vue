<script setup lang="ts">
const reducedMotion = usePreferredReducedMotion()
const prefersReduced = computed(() => reducedMotion.value === 'reduce')

const lights = [
  { class: 'salon-light salon-light--a', delay: '0s' },
  { class: 'salon-light salon-light--b', delay: '2.4s' }
] as const

const motes = [
  { left: '6%', top: '18%', size: 3, duration: 11, delay: 0 },
  { left: '14%', top: '62%', size: 2, duration: 14, delay: 1.4 },
  { left: '28%', top: '34%', size: 2.5, duration: 9.5, delay: 0.6 },
  { left: '42%', top: '12%', size: 2, duration: 13, delay: 2.1 },
  { left: '58%', top: '72%', size: 3, duration: 10.5, delay: 0.9 },
  { left: '71%', top: '28%', size: 2, duration: 12.5, delay: 1.8 },
  { left: '82%', top: '54%', size: 2.5, duration: 8.8, delay: 0.3 },
  { left: '91%', top: '16%', size: 2, duration: 15, delay: 2.6 },
  { left: '48%', top: '48%', size: 1.5, duration: 16, delay: 3.2 },
  { left: '22%', top: '82%', size: 2, duration: 12, delay: 1.1 }
] as const
</script>

<template>
  <div
    v-if="!prefersReduced"
    class="pointer-events-none absolute inset-0 overflow-hidden"
    aria-hidden="true"
  >
    <div
      v-for="light in lights"
      :key="light.class"
      :class="light.class"
      :style="{ animationDelay: light.delay }"
    />
    <span
      v-for="mote in motes"
      :key="`${mote.left}-${mote.top}`"
      class="salon-mote"
      :style="{
        left: mote.left,
        top: mote.top,
        width: `${mote.size}px`,
        height: `${mote.size}px`,
        animationDuration: `${mote.duration}s`,
        animationDelay: `${mote.delay}s`
      }"
    />
  </div>
</template>

<style scoped>
.salon-light {
  position: absolute;
  border-radius: 9999px;
  filter: blur(48px);
  animation: salon-drift 18s ease-in-out infinite;
}

.salon-light--a {
  top: -12%;
  left: 8%;
  width: 18rem;
  height: 18rem;
  background: oklch(0.55 0.08 82 / 0.16);
}

.salon-light--b {
  right: 4%;
  bottom: 8%;
  width: 14rem;
  height: 14rem;
  background: oklch(0.48 0.06 42 / 0.14);
  animation-duration: 22s;
  animation-direction: reverse;
}

.salon-mote {
  position: absolute;
  border-radius: 9999px;
  background: oklch(0.82 0.1 82 / 0.55);
  box-shadow: 0 0 8px oklch(0.78 0.1 82 / 0.35);
  animation: salon-mote ease-in-out infinite;
}

@keyframes salon-drift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.7;
  }
  50% {
    transform: translate3d(6%, 10%, 0) scale(1.18);
    opacity: 1;
  }
}

@keyframes salon-mote {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
    opacity: 0.15;
  }
  35% {
    transform: translate3d(12px, -28px, 0);
    opacity: 0.85;
  }
  70% {
    transform: translate3d(-8px, -48px, 0);
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .salon-light,
  .salon-mote {
    animation: none;
  }
}
</style>
