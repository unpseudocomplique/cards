<script setup lang="ts">
import { wonPileAnchor } from '~/utils/seatLayout'

const props = defineProps<{
  tricksWonBySeat: number[]
  localSeat: number
  playerCount: 3 | 4 | 5
  seats: Array<{ name: string | null } | null>
  sceneWidth: number
  sceneHeight: number
  highlightSeat?: number | null
}>()

function pileFor(seat: number) {
  return Math.min(props.tricksWonBySeat[seat] ?? 0, 12)
}

function styleFor(seat: number) {
  const anchor = wonPileAnchor(
    seat,
    props.localSeat,
    props.playerCount,
    props.sceneWidth,
    props.sceneHeight,
  )
  return {
    left: `${anchor.x}px`,
    top: `${anchor.y}px`,
    transform: 'translate(-50%, -50%)',
  }
}
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-[28]">
    <div
      v-for="(_, seat) in tricksWonBySeat"
      :key="`won-${seat}`"
      class="absolute"
      :style="styleFor(Number(seat))"
    >
      <div
        class="relative h-14 w-10 sm:h-16 sm:w-11"
        :class="highlightSeat === Number(seat) ? 'scale-110 transition-transform duration-300' : ''"
      >
        <div
          v-for="layer in pileFor(Number(seat))"
          :key="layer"
          class="absolute inset-0 rounded-md border border-white/15 bg-gradient-to-br from-stone-800 to-stone-950 shadow-md"
          :style="{
            transform: `translate(${(layer - 1) * 1.5}px, ${-(layer - 1) * 1.8}px) rotate(${(layer % 3 - 1) * 2}deg)`,
          }"
        >
          <div class="absolute inset-[3px] rounded-[4px] border border-amber-200/20" />
        </div>
        <p
          v-if="pileFor(Number(seat)) > 0"
          class="absolute -right-2.5 -top-2.5 z-10 min-w-[1.35rem] rounded-full bg-stone-950/90 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-amber-100 ring-1 ring-white/25"
        >
          {{ tricksWonBySeat[Number(seat)] }}
        </p>
      </div>
      <p
        v-if="seats[Number(seat)]?.name && Number(seat) !== localSeat"
        class="mt-1.5 max-w-[5.5rem] truncate text-center text-[10px] text-white/70"
      >
        {{ seats[Number(seat)]?.name }}
      </p>
    </div>
  </div>
</template>
