<script setup lang="ts">
import { seatLabelAnchor, wonCountInTag, wonPileAnchor } from '~/utils/seatLayout'

const props = defineProps<{
  tricksWonBySeat: number[]
  localSeat: number
  playerCount: 3 | 4 | 5
  seats: Array<{ name: string | null, controlledBy?: string } | null>
  sceneWidth: number
  sceneHeight: number
  mobile: boolean
  /** Seat whose turn it is, highlighted on its name tag. */
  activeSeat?: number | null
  highlightSeat?: number | null
  scores?: number[]
  takerSeat?: number | null
  partnerSeat?: number | null
}>()

/** Tap a name tag to see that player's score, tricks and side for a moment. */
const openSeat = shallowRef<number | null>(null)
let closeTimer: ReturnType<typeof setTimeout> | null = null

function toggleSeat(seat: number) {
  openSeat.value = openSeat.value === seat ? null : seat
  if (closeTimer) {
    clearTimeout(closeTimer)
  }
  if (openSeat.value !== null) {
    closeTimer = setTimeout(() => {
      openSeat.value = null
    }, 4000)
  }
}

onUnmounted(() => {
  if (closeTimer) {
    clearTimeout(closeTimer)
  }
})

function roleLabel(seat: number) {
  if (props.takerSeat === seat) {
    return 'Preneur'
  }
  if (props.partnerSeat === seat) {
    return 'Partenaire'
  }
  return props.takerSeat != null ? 'Défense' : null
}

const view = computed(() => ({ width: props.sceneWidth, height: props.sceneHeight, mobile: props.mobile }))

/** Phones: no pile on the felt, the count sits in the name tag. */
const countInTag = computed(() => wonCountInTag(view.value))

/** Opponents only: the local player's tricks are counted in the HUD bar. */
const opponents = computed(() => Array.from({ length: props.playerCount }, (_, seat) => seat)
  .filter(seat => seat !== props.localSeat)
  .map(seat => ({
    seat,
    name: props.seats[seat]?.name ?? `Joueur ${seat + 1}`,
    bot: props.seats[seat]?.controlledBy === 'bot',
    won: props.tricksWonBySeat[seat] ?? 0,
    pile: wonPileAnchor(seat, props.localSeat, props.playerCount, view.value),
    label: seatLabelAnchor(seat, props.localSeat, props.playerCount, view.value)
  })))

function layers(won: number) {
  return Math.min(won, 12)
}
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-[28]">
    <template
      v-for="opponent in opponents"
      :key="opponent.seat"
    >
      <!-- Name tag above the guest's head; tap for details -->
      <div
        class="absolute -translate-x-1/2 -translate-y-full"
        :style="{ left: `${opponent.label.x}px`, top: `${opponent.label.y}px` }"
      >
        <button
          type="button"
          class="pointer-events-auto flex max-w-[8rem] items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm ring-1 backdrop-blur-sm transition duration-300 sm:text-xs"
          :class="[
            activeSeat === opponent.seat
              ? 'bg-amber-300 text-neutral-950 ring-amber-200'
              : 'bg-black/55 text-white/90 ring-white/15',
            highlightSeat === opponent.seat ? 'scale-110' : ''
          ]"
          :aria-expanded="openSeat === opponent.seat"
          @click="toggleSeat(opponent.seat)"
        >
          <UIcon
            v-if="opponent.bot"
            name="i-lucide-bot"
            class="size-3 shrink-0 opacity-70"
          />
          <span class="truncate">{{ opponent.name }}</span>
          <UIcon
            v-if="takerSeat === opponent.seat"
            name="i-lucide-crown"
            class="size-3 shrink-0"
            :class="activeSeat === opponent.seat ? 'text-neutral-950' : 'text-amber-300'"
          />
        </button>
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="-translate-y-1 opacity-0"
          leave-active-class="transition duration-150 ease-in"
          leave-to-class="-translate-y-1 opacity-0"
        >
          <div
            v-if="openSeat === opponent.seat"
            class="absolute top-full left-1/2 z-10 mt-1.5 -translate-x-1/2 rounded-xl bg-neutral-950/90 px-3 py-2 text-xs whitespace-nowrap text-white shadow-xl ring-1 ring-white/15 backdrop-blur-md"
          >
            <p class="font-semibold tabular-nums">
              {{ scores?.[opponent.seat] ?? 0 }} pts · {{ opponent.won }} pli{{ opponent.won > 1 ? 's' : '' }}
            </p>
            <p
              v-if="roleLabel(opponent.seat)"
              class="mt-0.5 text-white/60"
            >
              {{ roleLabel(opponent.seat) }}
            </p>
          </div>
        </Transition>
      </div>

      <!-- Won tricks, on the felt beside them -->
      <div
        v-if="opponent.won > 0 && !countInTag"
        class="absolute -translate-x-1/2 -translate-y-1/2"
        :style="{ left: `${opponent.pile.x}px`, top: `${opponent.pile.y}px` }"
      >
        <div
          class="relative h-14 w-10 sm:h-16 sm:w-11"
          :class="highlightSeat === opponent.seat ? 'scale-110 transition-transform duration-300' : ''"
        >
          <div
            v-for="layer in layers(opponent.won)"
            :key="layer"
            class="absolute inset-0 rounded-md border border-white/15 bg-gradient-to-br from-stone-800 to-stone-950 shadow-md"
            :style="{ transform: `translate(${(layer - 1) * 1.5}px, ${-(layer - 1) * 1.8}px) rotate(${(layer % 3 - 1) * 2}deg)` }"
          >
            <div class="absolute inset-[3px] rounded-[4px] border border-amber-200/20" />
          </div>
          <p class="absolute -top-2.5 -right-2.5 z-10 min-w-[1.35rem] rounded-full bg-stone-950/90 px-1.5 py-0.5 text-center text-[11px] font-semibold text-amber-100 tabular-nums ring-1 ring-white/25">
            {{ opponent.won }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
