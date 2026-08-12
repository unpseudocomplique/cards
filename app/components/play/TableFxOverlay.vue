<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'

export type TableFxKind = 'bout' | 'petit-steal' | 'trick-won'

export type TableFxEvent = {
  id: string
  kind: TableFxKind
  title: string
  subtitle?: string
  details?: string[]
  accent?: 'gold' | 'rose' | 'slate'
}

defineProps<{
  events: TableFxEvent[]
}>()

const prefersReduced = usePreferredReducedMotion()

function particles(kind: TableFxKind) {
  if (kind === 'trick-won') {
    return Array.from({ length: 10 }, (_, i) => i)
  }
  const count = kind === 'petit-steal' ? 18 : 14
  return Array.from({ length: count }, (_, i) => i)
}

function particleStyle(index: number, kind: TableFxKind) {
  const count = kind === 'petit-steal' ? 18 : kind === 'trick-won' ? 10 : 14
  const angle = (index / count) * Math.PI * 2
  const dist = (kind === 'trick-won' ? 36 : 48) + (index % 5) * 16
  return {
    '--dx': `${Math.cos(angle) * dist}px`,
    '--dy': `${Math.sin(angle) * dist - 20}px`,
    '--delay': `${(index % 6) * 35}ms`,
    '--rot': `${(index * 37) % 360}deg`,
  }
}

function eyebrow(kind: TableFxKind) {
  if (kind === 'petit-steal') {
    return 'Provocation'
  }
  if (kind === 'bout') {
    return 'Bout'
  }
  return 'Fin de pli'
}

function panelClass(event: TableFxEvent) {
  if (event.kind === 'petit-steal' || event.accent === 'rose') {
    return 'border-rose-300/40 bg-rose-950/85 text-rose-50'
  }
  if (event.kind === 'bout' || event.accent === 'gold') {
    return 'border-amber-200/35 bg-black/78 text-amber-50'
  }
  return 'border-white/20 bg-stone-950/82 text-stone-50'
}

function eyebrowClass(event: TableFxEvent) {
  if (event.kind === 'petit-steal' || event.accent === 'rose') {
    return 'text-rose-200/80'
  }
  if (event.kind === 'bout' || event.accent === 'gold') {
    return 'text-amber-200/70'
  }
  return 'text-white/55'
}

function subtitleClass(event: TableFxEvent) {
  if (event.kind === 'petit-steal' || event.accent === 'rose') {
    return 'text-rose-100/85'
  }
  if (event.kind === 'bout' || event.accent === 'gold') {
    return 'text-white/70'
  }
  return 'text-white/75'
}
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 z-[70] overflow-hidden"
    data-testid="table-fx-root"
  >
    <AnimatePresence>
      <motion.div
        v-for="event in events"
        :key="event.id"
        class="absolute inset-0 flex items-center justify-center"
        :data-testid="`table-fx-${event.kind}`"
        :data-fx-title="event.title"
        :initial="prefersReduced ? false : { opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.22 }"
      >
        <div
          class="absolute inset-0"
          :class="event.kind === 'petit-steal' || event.accent === 'rose'
            ? 'bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.28),transparent_55%)]'
            : event.kind === 'bout' || event.accent === 'gold'
              ? 'bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.22),transparent_55%)]'
              : 'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),transparent_52%)]'"
        />

        <div
          v-if="!prefersReduced && event.kind !== 'trick-won'"
          class="absolute left-1/2 top-[38%] h-0 w-0"
        >
          <span
            v-for="i in particles(event.kind)"
            :key="i"
            class="table-fx-particle absolute left-0 top-0"
            :class="event.kind === 'petit-steal' ? 'table-fx-particle--steal' : 'table-fx-particle--bout'"
            :style="particleStyle(i, event.kind)"
          />
        </div>

        <motion.div
          class="relative mx-4 max-w-md rounded-2xl border px-5 py-4 text-center shadow-2xl backdrop-blur-md"
          :class="panelClass(event)"
          :initial="prefersReduced ? false : { scale: 0.82, y: 18, rotate: event.kind === 'petit-steal' ? -5 : 0 }"
          :animate="{ scale: 1, y: 0, rotate: 0 }"
          :transition="{ type: 'spring', stiffness: 300, damping: 20 }"
        >
          <p
            class="text-[10px] tracking-[0.25em] uppercase"
            :class="eyebrowClass(event)"
          >
            {{ eyebrow(event.kind) }}
          </p>
          <p class="mt-1 font-serif text-2xl font-semibold tracking-wide sm:text-3xl">
            {{ event.title }}
          </p>
          <p
            v-if="event.subtitle"
            class="mt-2 text-sm sm:text-base"
            :class="subtitleClass(event)"
          >
            {{ event.subtitle }}
          </p>
          <ul
            v-if="event.details?.length"
            class="mt-3 space-y-1 border-t border-white/10 pt-3 text-left text-xs text-white/70 sm:text-sm"
          >
            <li
              v-for="(line, i) in event.details"
              :key="i"
              class="flex gap-2"
            >
              <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
              <span>{{ line }}</span>
            </li>
          </ul>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </div>
</template>

<style scoped>
.table-fx-particle {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  opacity: 0;
  animation: table-fx-burst 900ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  animation-delay: var(--delay);
  transform: translate(-50%, -50%) rotate(var(--rot));
}

.table-fx-particle--bout {
  background: linear-gradient(135deg, #fde68a, #f59e0b);
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.8);
  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
}

.table-fx-particle--steal {
  width: 8px;
  height: 14px;
  border-radius: 1px;
  background: linear-gradient(180deg, #fb7185, #e11d48);
  box-shadow: 0 0 14px rgba(244, 63, 94, 0.85);
}

@keyframes table-fx-burst {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.4) rotate(var(--rot));
  }
  18% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.15) rotate(calc(var(--rot) + 120deg));
  }
}
</style>
