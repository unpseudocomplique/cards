<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import type { ShownEmote } from '~/composables/useTableEmotes'
import { seatLabelAnchor } from '~/utils/seatLayout'

const props = defineProps<{
  emotes: ShownEmote[]
  localSeat: number
  playerCount: 3 | 4 | 5
  sceneWidth: number
  sceneHeight: number
  mobile: boolean
}>()

const prefersReduced = usePreferredReducedMotion()

/** Above the player's name tag; the local player's at the left, above the hand. */
function anchor(seat: number) {
  if (seat === props.localSeat) {
    const short = props.sceneHeight <= 520
    return { x: 36, y: props.sceneHeight * (short ? 0.5 : 0.68) }
  }
  const view = { width: props.sceneWidth, height: props.sceneHeight, mobile: props.mobile }
  const tag = seatLabelAnchor(seat, props.localSeat, props.playerCount, view)
  return { x: tag.x, y: tag.y - 30 }
}
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 z-[32]"
    aria-live="polite"
  >
    <AnimatePresence>
      <motion.div
        v-for="item in emotes"
        :key="item.id"
        class="absolute"
        :style="{ left: `${anchor(item.seat).x}px`, top: `${anchor(item.seat).y}px` }"
        :initial="prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: 10 }"
        :animate="{ opacity: 1, scale: 1, y: 0 }"
        :exit="prefersReduced ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.9 }"
        :transition="{ type: 'spring', stiffness: 420, damping: 18 }"
      >
        <span
          class="grid size-12 -translate-x-1/2 -translate-y-full place-items-center rounded-full bg-neutral-950/80 text-[28px] leading-none shadow-xl ring-1 ring-white/20 backdrop-blur-sm"
          role="img"
          :aria-label="`Réaction : ${item.emote}`"
        >{{ item.emote }}</span>
      </motion.div>
    </AnimatePresence>
  </div>
</template>
