<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import type { CardId } from '~~/shared/tarot'
import { resolveTrick } from '~~/shared/tarot'
import { trickCardHeight as trickCardHeightFor, trickSpot, trickZone, wonPileAnchor } from '~/utils/seatLayout'
import { seatColor } from '~/utils/seatColors'

export type TrickEntry = { seat: number, card: CardId }

const props = defineProps<{
  trick: TrickEntry[]
  faceUrls: Map<string, string | null> | Record<string, string | null>
  seats?: Array<{ name: string | null } | null>
  localSeat: number
  playerCount: 3 | 4 | 5
  sceneWidth: number
  sceneHeight: number
  mobile?: boolean
  /** Winner seat while collecting the trick toward their pile. */
  collectingToSeat?: number | null
  winnerName?: string | null
  /** Shown while the finished trick is held before collect. */
  holdBanner?: string | null
  /** 5 players: the king the taker called, flagged when it lands on the felt. */
  calledKing?: CardId | null
  /** Prototype: 'seat' = each card in front of its player, 'row' = coloured row. */
  variant?: 'current' | 'seat' | 'row'
}>()

const variant = computed(() => props.variant ?? 'current')

/** The card that currently takes the trick. */
const leaderSeat = computed(() => {
  if (props.trick.length < 2) {
    return null
  }
  try {
    return resolveTrick(props.trick).winnerSeat
  } catch {
    return null
  }
})

const seatTrickHeight = computed(() => {
  const base = trickCardHeight.value ?? 100
  return Math.round(base * (props.playerCount === 5 ? 1.0 : 1.1))
})

/** Upright phones: a fixed ring of spots around the trick centre, one per seat. */
const UPRIGHT_SPOTS: Record<number, Array<[number, number]>> = {
  3: [[0, 0.62], [-0.55, -0.35], [0.55, -0.35]],
  4: [[0, 0.62], [-0.6, 0], [0, -0.62], [0.6, 0]],
  5: [[0, 0.62], [-0.66, 0.12], [-0.33, -0.56], [0.33, -0.56], [0.66, 0.12]],
}

function seatSpot(seat: number) {
  const view = { width: props.sceneWidth, height: props.sceneHeight, mobile: props.mobile ?? false }
  const h = seatTrickHeight.value
  const w = h * 0.62
  const rel = (seat - props.localSeat + props.playerCount) % props.playerCount
  const zone = trickZone(view, props.playerCount)
  const upright = props.sceneHeight > props.sceneWidth * 1.15
  void trickSpot
  let x: number
  let y: number
  const [fx, fy] = UPRIGHT_SPOTS[props.playerCount]![rel]!
  if (upright) {
    x = zone.centerX + fx * (props.sceneWidth / 2 - w / 2 - 10)
    y = zone.centerY + h * 0.25 + fy * (h * 1.4)
  } else {
    // Landscape and desktop: a flatter ring that stays clear of the hand.
    x = zone.centerX + fx * Math.min(props.sceneWidth / 2 - w / 2 - 10, w * 3.2)
    y = zone.centerY + fy * (h * (props.sceneHeight <= 520 ? 0.9 : 1.15))
  }
  return {
    x: Math.min(props.sceneWidth - w / 2 - 6, Math.max(w / 2 + 6, x)),
    y,
  }
}

/** Local and side players: name under the card, so it never hides under a neighbour. */
function chipBelow(seat: number) {
  const rel = (seat - props.localSeat + props.playerCount) % props.playerCount
  if (rel === 0) {
    return true
  }
  return props.playerCount === 5 ? rel === 1 || rel === 4 : props.playerCount === 4 ? rel !== 2 : false
}

function seatTilt(seat: number) {
  const rel = (seat - props.localSeat + props.playerCount) % props.playerCount
  // Cards lean toward the player who laid them.
  const offsets: Record<number, number[]> = {
    3: [0, 14, -14],
    4: [0, 12, 0, -12],
    5: [0, 16, 6, -6, -16],
  }
  return offsets[props.playerCount]?.[rel] ?? 0
}

const prefersReduced = usePreferredReducedMotion()

/** Phones: trick cards sized from the screen (see seatLayout's trickCardHeight). */
const trickCardHeight = computed(() =>
  trickCardHeightFor({ width: props.sceneWidth, height: props.sceneHeight }, props.playerCount))

/** "Title — reason" from the table: title in bold, reason smaller below. */
const bannerParts = computed(() => {
  const [title, ...rest] = (props.holdBanner ?? '').split(' — ')
  return { title, reason: rest.join(' — ') }
})

function seatLabel(seat: number) {
  return seat === props.localSeat ? 'Vous' : props.seats?.[seat]?.name
}

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
  const view = { width: props.sceneWidth, height: props.sceneHeight, mobile: props.mobile ?? false }
  // Fly to the winner's pile on the felt (the local player's tricks go to the hand).
  const target = wonPileAnchor(props.collectingToSeat, props.localSeat, props.playerCount, view)
  const zone = trickZone(view, props.playerCount)
  const centerX = zone.centerX
  const centerY = zone.centerY
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
  <!-- Prototype A: each card on the felt in front of the player who laid it -->
  <div
    v-if="variant === 'seat' && sceneWidth > 0"
    class="pointer-events-none absolute inset-0 z-[15]"
  >
    <AnimatePresence>
      <motion.div
        v-for="(entry, index) in trick"
        :key="`${entry.seat}-${entry.card}`"
        class="absolute"
        :style="{ left: `${seatSpot(entry.seat).x}px`, top: `${seatSpot(entry.seat).y}px`, zIndex: index + 1 }"
        :initial="prefersReduced ? false : { opacity: 0, scale: 0.7 }"
        :animate="{
          opacity: collectOffset(entry.seat).opacity,
          x: collectingToSeat != null ? collectOffset(entry.seat).x - (seatSpot(entry.seat).x - sceneWidth / 2) : 0,
          y: collectingToSeat != null ? collectOffset(entry.seat).y : 0,
          scale: collectOffset(entry.seat).scale,
        }"
        :exit="{ opacity: 0, scale: 0.5 }"
        :transition="spring"
      >
        <div
          class="relative -translate-x-1/2 -translate-y-1/2"
          :style="{ rotate: `${seatTilt(entry.seat)}deg` }"
        >
          <div
            class="relative rounded-[6px] transition-transform duration-300"
            :class="leaderSeat === entry.seat && collectingToSeat == null ? '-translate-y-1.5' : ''"
            :style="{
              height: `${seatTrickHeight}px`,
              aspectRatio: 'var(--table-card-ratio, 2 / 3)',
              boxShadow: entry.card === calledKing
                ? '0 0 0 3px #38bdf8, 0 0 22px 6px rgba(56,189,248,0.55)'
                : leaderSeat === entry.seat && collectingToSeat == null
                  ? '0 0 0 3px #fcd34d, 0 0 20px 4px rgba(252,211,77,0.45)'
                  : `0 0 0 2px ${seatColor(entry.seat)}`,
            }"
          >
            <PlayDeckCard
              :card-id="entry.card"
              :face-url="faceUrlFor(entry.card)"
              size="md"
              fill
              :index-px="Math.max(13, Math.round(seatTrickHeight * 0.12))"
            />
            <span
              v-if="leaderSeat === entry.seat && collectingToSeat == null"
              class="absolute -top-2.5 -right-2.5 grid size-6 place-items-center rounded-full bg-amber-300 text-neutral-950 shadow-lg ring-2 ring-neutral-950/60"
              title="Carte maîtresse"
            >
              <UIcon name="i-lucide-crown" class="size-3.5" />
            </span>
            <p
              v-if="entry.card === calledKing && collectingToSeat == null"
              class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-[6px] bg-sky-400 py-0.5 text-[9px] font-bold tracking-wide text-sky-950 uppercase"
            >
              <UIcon name="i-lucide-handshake" class="size-3" />
              Appelé
            </p>
          </div>
          <!-- Name chip on the side of the player who laid the card -->
          <p
            v-if="collectingToSeat == null"
            class="absolute left-1/2 flex w-max max-w-[6.5rem] -translate-x-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] leading-tight font-semibold text-neutral-950 shadow-md"
            :class="chipBelow(entry.seat) ? 'top-full mt-1.5' : 'bottom-full mb-1.5'"
            :style="{ background: seatColor(entry.seat), rotate: `${-seatTilt(entry.seat)}deg` }"
          >
            <span class="truncate">{{ seatLabel(entry.seat) }}</span>
          </p>
        </div>
      </motion.div>
    </AnimatePresence>

    <div
      v-if="collectingToSeat != null && winnerName || holdBanner"
      class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
      :style="{ top: `${trickZone({ width: sceneWidth, height: sceneHeight, mobile: mobile ?? false }, playerCount).centerY}px` }"
    >
      <div class="w-max max-w-[min(18rem,80vw)] rounded-2xl border border-white/15 bg-neutral-950/85 px-3.5 py-1.5 text-center shadow-xl backdrop-blur-md">
        <p class="font-display text-lg leading-tight text-amber-50">
          {{ collectingToSeat != null ? `Pli pour ${winnerName}` : bannerParts.title }}
        </p>
        <p v-if="collectingToSeat == null && bannerParts.reason" class="text-[11px] leading-snug text-white/60">
          {{ bannerParts.reason }}
        </p>
      </div>
    </div>
  </div>

  <div v-else class="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center px-3 pb-[18vh] sm:pb-[14vh] upright:pb-[8vh] short:pb-[21vh]">
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
          <div
            v-if="trickCardHeight"
            class="relative rounded-[6px] transition-transform duration-300"
            :class="variant === 'row' && leaderSeat === entry.seat && collectingToSeat == null ? '-translate-y-2' : ''"
            :style="{
              height: `${trickCardHeight}px`,
              aspectRatio: 'var(--table-card-ratio, 2 / 3)',
              boxShadow: variant !== 'row' ? undefined
                : entry.card === calledKing
                  ? '0 0 0 3px #38bdf8, 0 0 22px 6px rgba(56,189,248,0.55)'
                  : leaderSeat === entry.seat && collectingToSeat == null
                    ? '0 0 0 3px #fcd34d, 0 0 20px 4px rgba(252,211,77,0.45)'
                    : undefined,
            }"
          >
            <p
              v-if="variant === 'row' && entry.card === calledKing && collectingToSeat == null"
              class="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-1 rounded-b-[6px] bg-sky-400 py-0.5 text-[9px] font-bold tracking-wide text-sky-950 uppercase"
            >
              <UIcon name="i-lucide-handshake" class="size-3" />
              Appelé
            </p>
            <span
              v-if="variant === 'row' && leaderSeat === entry.seat && collectingToSeat == null"
              class="absolute -top-2.5 -right-2.5 z-10 grid size-6 place-items-center rounded-full bg-amber-300 text-neutral-950 shadow-lg ring-2 ring-neutral-950/60"
            >
              <UIcon name="i-lucide-crown" class="size-3.5" />
            </span>
            <PlayDeckCard
              :card-id="entry.card"
              :face-url="faceUrlFor(entry.card)"
              size="md"
              fill
              :index-px="Math.max(13, Math.round(trickCardHeight * 0.12))"
            />
          </div>
          <PlayDeckCard
            v-else
            :card-id="entry.card"
            :face-url="faceUrlFor(entry.card)"
            size="sm"
          />
          <p
            v-if="variant === 'row' && collectingToSeat == null"
            class="mx-auto mt-1.5 flex w-fit max-w-[5rem] items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-[12px] leading-tight font-semibold text-neutral-950 shadow-md"
            :style="{ background: seatColor(entry.seat) }"
          >
            <span class="grid size-4 shrink-0 place-items-center rounded-full bg-neutral-950/80 text-[10px] text-white tabular-nums">{{ index + 1 }}</span>
            <span class="truncate">{{ seatLabel(entry.seat) }}</span>
          </p>
          <p
            v-else-if="seatLabel(entry.seat) && collectingToSeat == null"
            class="mx-auto mt-1 w-fit max-w-[4.5rem] truncate rounded-md bg-black/55 px-1.5 py-px text-center text-[10px] text-white/85 backdrop-blur-sm sm:text-xs"
          >
            {{ seatLabel(entry.seat) }}
          </p>
        </motion.div>
      </AnimatePresence>

      <motion.div
        v-if="collectingToSeat != null && winnerName"
        class="pointer-events-none absolute -top-10 left-1/2 upright:top-auto upright:-bottom-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-amber-200/30 bg-black/70 px-3 py-1 text-xs font-semibold tracking-wide text-amber-100 uppercase"
        :initial="{ opacity: 0, y: 8, scale: 0.9 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :transition="{ type: 'spring', stiffness: 320, damping: 22 }"
      >
        Pli pour {{ winnerName }}
      </motion.div>
      <motion.div
        v-else-if="holdBanner"
        class="pointer-events-none absolute -top-14 left-1/2 w-max max-w-[min(20rem,90vw)] -translate-x-1/2 rounded-2xl border border-white/15 bg-neutral-950/85 px-3.5 py-1.5 text-center shadow-xl backdrop-blur-md upright:top-auto upright:-bottom-14"
        :initial="{ opacity: 0, y: 8, scale: 0.96 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :transition="{ type: 'spring', stiffness: 300, damping: 22 }"
      >
        <p class="font-display text-lg leading-tight text-amber-50">
          {{ bannerParts.title }}
        </p>
        <p
          v-if="bannerParts.reason"
          class="text-[11px] leading-snug text-white/60"
        >
          {{ bannerParts.reason }}
        </p>
      </motion.div>
    </div>
  </div>
</template>
