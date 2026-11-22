<script setup lang="ts">
import type { PublicGameView } from '~~/shared/tarot'
import { requiredPoints } from '~~/shared/tarot'
import { contractLabels } from '~/utils/tarotContracts'

/**
 * Plaque hanging from the top of the table: attack and defence points live,
 * climbing at each trick (+N flies off), and the attack's goal from the bouts
 * it holds. Before the contract: the deal number and the match goal.
 */
const props = defineProps<{
  state: PublicGameView
  localSeat: number | null
  /** 5 players: the local player secretly holds the called king. */
  calledPartner?: boolean
}>()

const bid = computed(() => props.state.bid)
const live = computed(() => Boolean(bid.value) && ['DogEcarta', 'ReadyToPlay', 'Trick', 'Scoring'].includes(props.state.phase))

/** Attack seats as this player knows them: taker, partner once revealed (or yourself, secretly). */
const attackSeats = computed(() => {
  const seats = new Set<number>()
  if (!bid.value) {
    return seats
  }
  seats.add(bid.value.seat)
  if (props.state.partnerSeat != null) {
    seats.add(props.state.partnerSeat)
  } else if (props.calledPartner && props.localSeat != null) {
    seats.add(props.localSeat)
  }
  return seats
})

function sum(values: number[] | undefined, pick: (seat: number) => boolean) {
  return (values ?? []).reduce((total, value, seat) => total + (pick(seat) ? value : 0), 0)
}

const attackRaw = computed(() => props.state.phase === 'Scoring' && props.state.lastDeal
  ? props.state.lastDeal.points
  : sum(props.state.pointsWonBySeat, seat => attackSeats.value.has(seat)))
const defenseRaw = computed(() => props.state.phase === 'Scoring' && props.state.lastDeal
  ? 91 - props.state.lastDeal.points
  : sum(props.state.pointsWonBySeat, seat => !attackSeats.value.has(seat)))
const oudlers = computed(() => props.state.phase === 'Scoring' && props.state.lastDeal
  ? props.state.lastDeal.oudlers
  : Math.min(3, sum(props.state.oudlersWonBySeat, seat => attackSeats.value.has(seat))) as 0 | 1 | 2 | 3)
const goal = computed(() => requiredPoints(oudlers.value))

const prefersReduced = usePreferredReducedMotion()
const attackShown = useTransition(attackRaw, { duration: 700, disabled: computed(() => prefersReduced.value === 'reduce') })
const defenseShown = useTransition(defenseRaw, { duration: 700, disabled: computed(() => prefersReduced.value === 'reduce') })

function format(value: number) {
  const rounded = Math.round(value * 2) / 2
  return Number.isInteger(rounded) ? String(rounded) : `${Math.floor(rounded)}½`
}

/** "+N" flying off a side when its points go up. */
const gains = ref<Array<{ id: number, side: 'attack' | 'defense', value: number }>>([])
let gainId = 0
function pushGain(side: 'attack' | 'defense', value: number) {
  if (value <= 0 || props.state.phase === 'Scoring') {
    return
  }
  const id = ++gainId
  gains.value = [...gains.value, { id, side, value }]
  setTimeout(() => {
    gains.value = gains.value.filter(item => item.id !== id)
  }, 1500)
}
watch(attackRaw, (now, before) => pushGain('attack', now - (before ?? 0)))
watch(defenseRaw, (now, before) => pushGain('defense', now - (before ?? 0)))

const progress = computed(() => Math.min(1, attackRaw.value / 91))
const goalMark = computed(() => goal.value / 91)

const takerName = computed(() => {
  if (!bid.value) {
    return null
  }
  return bid.value.seat === props.localSeat ? 'vous' : props.state.seats[bid.value.seat]?.name ?? ''
})

const caption = computed(() => {
  if (!bid.value || props.state.phase === 'Bidding') {
    const goalText = props.state.endMode === 'threshold' ? `${props.state.endValue} pts` : `${props.state.dealIndex + 1}/${props.state.endValue}`
    return `Donne ${props.state.dealIndex + 1} · ${goalText}`
  }
  return `${contractLabels[bid.value.contract]} de ${takerName.value} · il faut ${goal.value} (${oudlers.value} bout${oudlers.value > 1 ? 's' : ''})`
})
</script>

<template>
  <div class="plaque-wrap">
    <div
      class="plaque"
      :class="{ 'plaque--live': live }"
    >
      <span
        class="plaque-side"
        title="Attaque"
      >
        <span class="plaque-chip plaque-chip--attack"><UIcon
          name="i-lucide-sword"
          class="size-3.5"
        /></span>
        <b>{{ live ? format(attackShown) : '–' }}</b>
      </span>
      <span class="plaque-sep" />
      <span
        class="plaque-side"
        title="Défense"
      >
        <b>{{ live ? format(defenseShown) : '–' }}</b>
        <span class="plaque-chip plaque-chip--defense"><UIcon
          name="i-lucide-shield"
          class="size-3.5"
        /></span>
      </span>
      <span
        v-if="live"
        class="plaque-bar"
      >
        <i :style="{ transform: `scaleX(${progress})` }" />
        <u :style="{ left: `${goalMark * 100}%` }" />
      </span>

      <TransitionGroup name="plaque-gain">
        <span
          v-for="gain in gains"
          :key="gain.id"
          class="plaque-gain"
          :class="gain.side === 'attack' ? 'plaque-gain--attack' : 'plaque-gain--defense'"
        >+{{ format(gain.value) }}</span>
      </TransitionGroup>
    </div>
    <p class="plaque-caption">
      {{ caption }}
    </p>
  </div>
</template>

<style scoped>
.plaque-wrap { display: flex; flex-direction: column; align-items: center; }
.plaque {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 5px 14px 8px;
  border-radius: 0 0 12px 12px;
  background: linear-gradient(#4a2c1a, #2e1a0f);
  border: 2px solid #c9a463;
  border-top: 0;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -3px 0 rgba(0, 0, 0, 0.35);
}
.plaque-side { display: flex; align-items: center; gap: 7px; }
.plaque-side b {
  min-width: 2.2ch;
  text-align: center;
  font-size: 22px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #f6e7c4;
  text-shadow: 0 1px 0 #000;
}
.plaque-chip {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  color: #fff;
  border: 1.5px solid #f2d79a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
.plaque-chip--attack { background: #b23a2a; }
.plaque-chip--defense { background: #2d5e9c; }
.plaque-sep { width: 1px; height: 22px; margin: 0 12px; background: rgba(201, 164, 99, 0.5); }
.plaque-bar {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 3px;
  height: 3px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.5);
}
.plaque-bar i {
  position: absolute;
  inset: 0;
  border-radius: 2px;
  background: linear-gradient(90deg, #d4553e, #ffbf6b);
  transform-origin: left;
  transition: transform 700ms cubic-bezier(.2, .8, .2, 1);
}
.plaque-bar u { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: #f6e7c4; transition: left 500ms; }
.plaque-caption {
  margin-top: 5px;
  max-width: min(78vw, 22rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(246, 231, 196, 0.8);
  text-shadow: 0 1px 3px #000;
}

.plaque-gain {
  position: absolute;
  top: 6px;
  font-size: 16px;
  font-weight: 800;
  color: #ffd27a;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
  pointer-events: none;
}
.plaque-gain--attack { right: calc(100% + 6px); }
.plaque-gain--defense { left: calc(100% + 6px); color: #b9d8ff; }
.plaque-gain-enter-active { animation: plaque-gain 1.5s cubic-bezier(.2, .8, .2, 1) forwards; }
.plaque-gain-leave-active { display: none; }
@keyframes plaque-gain {
  0% { opacity: 0; transform: translateY(14px) scale(0.6); }
  18% { opacity: 1; transform: translateY(0) scale(1.15); }
  30% { transform: scale(1); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-10px); }
}

@media (max-height: 520px) {
  .plaque { padding: 3px 12px 7px; }
  .plaque-side b { font-size: 19px; }
  .plaque-caption { margin-top: 3px; font-size: 9px; }
}
</style>
