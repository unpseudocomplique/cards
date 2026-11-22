<script setup lang="ts">
import type { PublicGameView } from '~~/shared/tarot'
import { cutRange, TAROT_PACK_SIZE } from '~~/shared/tarot/cut'

/**
 * The cut. The pack is drawn as a row of card edges, one per card: under the
 * finger the edges rise like a lifted packet and fall away on both sides.
 * The cutter slides to choose where to cut; everybody else watches, then
 * sees the two packets swap when the cut is made (`replay`).
 */
const props = defineProps<{
  state: PublicGameView
  localSeat: number | null
  /** The cut just made (everybody sees the packets swap). */
  replay?: { seat: number, at: number } | null
}>()

const emit = defineEmits<{
  cut: [at: number]
}>()

const size = computed(() => props.state.deckCount || TAROT_PACK_SIZE)
const range = computed(() => cutRange(size.value))
const cutterSeat = computed(() => props.replay?.seat ?? props.state.currentSeat)
const myCut = computed(() => !props.replay && props.state.phase === 'Cutting' && props.localSeat === props.state.currentSeat)

function seatName(seat: number) {
  if (seat === props.localSeat) {
    return 'Vous'
  }
  return props.state.seats[seat]?.name ?? `Joueur ${seat + 1}`
}

const dealerName = computed(() => seatName(props.state.dealerSeat))

const origin = computed(() => {
  if (props.state.redealReason === 'petit_sec') {
    return 'Petit sec : la donne est annulée, le jeu est rebattu.'
  }
  if (props.state.redealReason === 'all_pass') {
    return 'Tout le monde a passé : les mains sont regroupées, sans mélanger.'
  }
  if (props.state.deckSource === 'gathered') {
    return 'Les plis de la donne précédente sont ramassés tels quels, sans mélanger.'
  }
  return 'Le jeu est battu pour la première donne.'
})

/* Cut position: cards lifted from the top of the pack. */
const middle = Math.round(TAROT_PACK_SIZE / 2)
const at = shallowRef(middle - 4 + Math.floor(Math.random() * 9))
const dragging = shallowRef(false)
const sent = shallowRef(false)

watch(() => props.state.version, () => {
  if (props.state.phase !== 'Cutting') {
    sent.value = false
  }
})
watch(() => props.state.currentSeat, () => {
  sent.value = false
})

function clamp(value: number) {
  return Math.min(range.value.max, Math.max(range.value.min, Math.round(value)))
}

/* Watchers' pack breathes gently so it does not look frozen. */
const idlePhase = shallowRef(0)
let raf = 0
function tick(time: number) {
  idlePhase.value = time / 1000
  raf = requestAnimationFrame(tick)
}
onMounted(() => {
  if (!prefersReducedMotion.value) {
    raf = requestAnimationFrame(tick)
  }
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

/** Where the wave peaks: the chosen cut, or a slow drift while someone else cuts. */
const peak = computed(() => {
  if (props.replay) {
    // The packets are squared up again while they swap.
    return -1000
  }
  if (myCut.value || sent.value) {
    return at.value
  }
  return middle + Math.sin(idlePhase.value * 0.9) * 14
})

/** Height of each card edge, 0..1: a bell around the cut, a low pack elsewhere. */
const heights = computed(() => {
  const sigma = dragging.value ? 5 : 6.5
  return Array.from({ length: size.value }, (_, index) => {
    const distance = index + 0.5 - peak.value
    const bell = Math.exp(-(distance * distance) / (2 * sigma * sigma))
    // A little unevenness, like real card edges.
    const grain = ((index * 37) % 11) / 110
    return 0.2 + grain + bell * 0.72
  })
})

const cutIndex = computed(() => props.replay?.at ?? at.value)
/** Only the cutter (and everybody once it is done) sees the two packets. */
const showSplit = computed(() => Boolean(props.replay) || myCut.value || sent.value)

/* Pointer & keyboard */
const track = useTemplateRef<HTMLElement>('track')

function indexFromEvent(event: PointerEvent) {
  const rect = track.value?.getBoundingClientRect()
  if (!rect || rect.width === 0) {
    return at.value
  }
  return clamp(((event.clientX - rect.left) / rect.width) * size.value)
}

let lastBuzz = 0
function setAt(value: number) {
  const next = clamp(value)
  if (next === at.value) {
    return
  }
  at.value = next
  // A tiny tick under the finger for each card (Android).
  const now = performance.now()
  if (dragging.value && now - lastBuzz > 30) {
    lastBuzz = now
    navigator.vibrate?.(3)
  }
}

function onPointerDown(event: PointerEvent) {
  if (!myCut.value || sent.value) {
    return
  }
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  setAt(indexFromEvent(event))
}

function onPointerMove(event: PointerEvent) {
  if (dragging.value) {
    setAt(indexFromEvent(event))
  }
}

function onPointerUp() {
  dragging.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (!myCut.value || sent.value) {
    return
  }
  const steps: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 }
  if (event.key in steps) {
    event.preventDefault()
    setAt(at.value + steps[event.key]!)
  } else if (event.key === 'Home') {
    event.preventDefault()
    setAt(range.value.min)
  } else if (event.key === 'End') {
    event.preventDefault()
    setAt(range.value.max)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    confirm()
  }
}

function confirm() {
  if (!myCut.value || sent.value) {
    return
  }
  sent.value = true
  emit('cut', at.value)
}

/* Replay: the lifted packet goes under the rest. */
const replayStyle = computed(() => {
  const cut = props.replay?.at
  if (!cut) {
    return {}
  }
  const top = cut / size.value
  const rest = 1 - top
  return {
    '--lift-shift': `${(rest / top) * 100}%`,
    '--rest-shift': `${-(top / rest) * 100}%`
  }
})

const isShort = useMediaQuery('(max-height: 520px)')
</script>

<template>
  <div
    class="mx-auto w-full max-w-2xl rounded-2xl bg-neutral-950/75 p-3 text-white ring-1 ring-white/10 backdrop-blur-xl sm:p-4 short:max-w-3xl short:rounded-xl short:px-3 short:py-2"
    data-testid="cut-dock"
  >
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <p class="font-medium short:text-sm">
        <template v-if="replay">
          {{ cutterSeat === localSeat ? 'Vous coupez' : `${seatName(cutterSeat)} coupe` }} à {{ replay.at }} cartes
        </template>
        <template v-else-if="myCut">
          À vous de couper
        </template>
        <span
          v-else
          class="flex items-center gap-2 text-white/75"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-4 animate-spin"
          />
          {{ seatName(cutterSeat) }} coupe le jeu…
        </span>
      </p>
      <p class="text-xs text-white/55">
        Donneur : <span class="text-white/80">{{ dealerName }}</span>
      </p>
      <p class="w-full text-xs text-amber-100/70 short:w-auto short:ml-auto">
        {{ origin }}
      </p>
    </div>

    <!-- The pack, seen edge-on -->
    <div
      class="relative select-none"
      :class="[(myCut || sent) && !replay ? 'mt-8 short:mt-6' : 'mt-3 short:mt-2', myCut && !sent ? 'cursor-grab active:cursor-grabbing' : '']"
    >
      <div
        ref="track"
        class="cut-track relative flex h-24 items-end touch-none outline-none short:h-14"
        :class="{ 'is-replay': replay }"
        :style="replayStyle"
        role="slider"
        :tabindex="myCut ? 0 : -1"
        :aria-label="myCut ? 'Où couper le jeu' : 'Le jeu à couper'"
        :aria-valuemin="range.min"
        :aria-valuemax="range.max"
        :aria-valuenow="cutIndex"
        :aria-valuetext="`${cutIndex} cartes soulevées, ${size - cutIndex} restent`"
        :aria-disabled="!myCut || sent"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onKeydown"
      >
        <div
          class="cut-packet cut-lift flex h-full items-end"
          :style="{ width: `${(cutIndex / size) * 100}%` }"
        >
          <span
            v-for="index in cutIndex"
            :key="index"
            class="cut-edge"
            :class="{ 'is-lifted': showSplit, 'is-locked': index - 1 < range.min }"
            :style="{ transform: `scaleY(${heights[index - 1]})` }"
          />
        </div>
        <div
          class="cut-packet cut-rest flex h-full items-end"
          :style="{ width: `${((size - cutIndex) / size) * 100}%` }"
        >
          <span
            v-for="index in size - cutIndex"
            :key="index"
            class="cut-edge"
            :class="{ 'is-locked': cutIndex + index - 1 >= range.max }"
            :style="{ transform: `scaleY(${heights[cutIndex + index - 1]})` }"
          />
        </div>

        <!-- The cut itself -->
        <div
          v-if="(myCut || sent) && !replay"
          class="pointer-events-none absolute inset-y-0 w-0"
          :style="{ left: `${(cutIndex / size) * 100}%` }"
        >
          <div class="absolute -inset-y-1 -left-px w-0.5 rounded-full bg-amber-300 shadow-[0_0_12px_2px_rgba(252,211,77,0.55)]" />
          <div
            class="absolute -top-1 left-0 -translate-x-1/2 -translate-y-full rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-950 shadow"
            :class="dragging ? 'scale-110' : ''"
          >
            {{ cutIndex }}
          </div>
        </div>
      </div>

      <div
        v-if="showSplit"
        class="mt-1.5 flex justify-between text-[11px] text-white/50 tabular-nums"
      >
        <span><span class="text-amber-200/90">{{ cutIndex }}</span> soulevées</span>
        <span>{{ size - cutIndex }} restent</span>
      </div>
    </div>

    <div
      v-if="myCut"
      class="mt-3 flex items-center gap-2 short:mt-2"
    >
      <p class="flex-1 text-xs text-white/55">
        Glissez pour choisir. Au moins {{ range.min }} cartes de chaque côté.
      </p>
      <UButton
        :label="sent ? 'Coupe…' : 'Couper ici'"
        icon="i-lucide-scissors"
        :size="isShort ? 'md' : 'lg'"
        :loading="sent"
        class="rounded-full"
        @click="confirm"
      />
    </div>
  </div>
</template>

<style scoped>
.cut-edge {
  flex: 1 1 0;
  height: 100%;
  margin: 0 0.6px;
  min-width: 1px;
  border-radius: 1.5px 1.5px 0.5px 0.5px;
  transform-origin: bottom;
  background: linear-gradient(to bottom, #f6eedb, #d9ccb0 70%, #b9a985);
  box-shadow: inset -0.5px 0 0 rgba(0, 0, 0, 0.25);
  transition: transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms;
  will-change: transform;
}

.cut-edge.is-lifted {
  background: linear-gradient(to bottom, #fde68a, #f2c45a 70%, #c99a37);
}

.cut-edge.is-locked {
  opacity: 0.35;
}

.cut-packet {
  transition: width 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* The lifted packet rises, goes over to the right and lands under the rest. */
.is-replay .cut-lift {
  animation: cut-lift 1.1s cubic-bezier(0.45, 0, 0.2, 1) 0.15s forwards;
}

.is-replay .cut-rest {
  animation: cut-rest 1.1s cubic-bezier(0.45, 0, 0.2, 1) 0.15s forwards;
}

@keyframes cut-lift {
  0% { transform: translate(0, 0); }
  30% { transform: translate(0, -28%); }
  75% { transform: translate(var(--lift-shift), -28%); }
  100% { transform: translate(var(--lift-shift), 0); }
}

@keyframes cut-rest {
  0%, 30% { transform: translateX(0); }
  75%, 100% { transform: translateX(var(--rest-shift)); }
}

@media (prefers-reduced-motion: reduce) {
  .cut-edge,
  .cut-packet {
    transition: none;
  }

  .is-replay .cut-lift,
  .is-replay .cut-rest {
    animation-duration: 1ms;
  }
}
</style>
