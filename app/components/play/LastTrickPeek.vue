<script setup lang="ts">
import type { CardId, PublicGameView } from '~~/shared/tarot'
import { cardPoints, describeTrick } from '~~/shared/tarot'
import { seatColor } from '~/utils/seatColors'
import { seatAvatar } from '~/utils/seatAvatar'

/**
 * The previous trick, brought back on a small sheet of felt: the cards in the
 * order they were laid, who laid each one, who took it and what it was worth.
 */
const props = defineProps<{
  state: PublicGameView
  localSeat: number | null
  faceUrlFor: (card: CardId) => string | null
}>()

const emit = defineEmits<{ close: [] }>()

const trick = computed(() => props.state.previousTrick?.cards ?? [])
const winnerSeat = computed(() => props.state.previousTrick?.winnerSeat ?? null)

/** Tricks played so far in this deal; the one shown is the last of them. */
const trickNumber = computed(() => props.state.tricksWonBySeat.reduce((sum, count) => sum + count, 0))

function seatName(seat: number) {
  return seat === props.localSeat ? 'Vous' : props.state.seats[seat]?.name ?? `Joueur ${seat + 1}`
}

const summary = computed(() => {
  if (!trick.value.length) {
    return null
  }
  try {
    const named = { ...props.state, seats: props.state.seats.map((seat, index) => ({ ...seat, name: seatName(index) })) }
    return describeTrick(named, trick.value)
  } catch {
    return null
  }
})

/** Card points the winner takes (the Excuse stays with its owner before the last trick). */
const points = computed(() => {
  const total = trick.value.reduce((sum, entry) => {
    if (entry.card === 'excuse' && entry.seat !== winnerSeat.value) {
      return sum
    }
    return sum + cardPoints(entry.card)
  }, 0)
  const text = Number.isInteger(total) ? String(total) : `${Math.floor(total)}½`.replace(/^0½$/, '½')
  return `${text} ${total < 2 ? 'point' : 'points'}`
})

const hasExcuse = computed(() => trick.value.some(entry => entry.card === 'excuse' && entry.seat !== winnerSeat.value))

const calledKing = computed(() => props.state.calledKing ?? null)

onKeyStroke('Escape', () => emit('close'))
</script>

<template>
  <div
    class="peek"
    role="dialog"
    aria-modal="true"
    aria-labelledby="last-trick-title"
  >
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p
          id="last-trick-title"
          class="font-display text-lg leading-tight text-[#f6e7c4] short:text-base"
        >
          Pli précédent
          <span
            v-if="trickNumber"
            class="ml-1 text-sm text-[#e0c06a]/80"
          >n° {{ trickNumber }}</span>
        </p>
        <p
          v-if="summary"
          class="mt-0.5 text-[13px] leading-snug text-white/75 short:text-xs"
        >
          {{ summary.title }} — {{ summary.subtitle }}
        </p>
      </div>
      <PlayRoundButton
        icon="i-lucide-x"
        label="Fermer"
        class="shrink-0 scale-90"
        @click="emit('close')"
      />
    </header>

    <ol class="cards">
      <li
        v-for="(entry, index) in trick"
        :key="`${entry.seat}-${entry.card}`"
        class="card-slot"
        :class="{ 'card-slot--winner': entry.seat === winnerSeat }"
        :style="{ '--seat': seatColor(entry.seat), '--delay': `${index * 45}ms` }"
      >
        <span class="order">{{ index + 1 }}</span>
        <div class="card-box">
          <UIcon
            v-if="entry.seat === winnerSeat"
            name="i-lucide-crown"
            class="crown"
          />
          <PlayDeckCard
            :card-id="entry.card"
            :face-url="faceUrlFor(entry.card)"
            fill
            :highlighted="entry.seat === winnerSeat"
          />
          <span
            v-if="calledKing && entry.card === calledKing"
            class="called"
          >Appelé</span>
        </div>
        <span class="who">
          <span class="avatar">
            <img
              v-if="seatAvatar(state.seats[entry.seat]).src"
              :src="seatAvatar(state.seats[entry.seat]).src!"
              alt=""
            >
            <span v-else>{{ seatAvatar(state.seats[entry.seat]).initials }}</span>
          </span>
          <span class="truncate">{{ seatName(entry.seat) }}</span>
        </span>
      </li>
    </ol>

    <footer
      v-if="winnerSeat !== null"
      class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-white/80 short:text-xs"
    >
      <span class="flex items-center gap-1.5">
        <UIcon
          name="i-lucide-crown"
          class="size-4 text-[#e0c06a]"
        />
        <strong
          class="font-semibold"
          :style="{ color: seatColor(winnerSeat) }"
        >{{ seatName(winnerSeat) }}</strong>
        {{ winnerSeat === localSeat ? 'remportez' : 'remporte' }} le pli
      </span>
      <span class="text-white/60">·</span>
      <span>{{ points }}<span
        v-if="hasExcuse"
        class="text-white/50"
      > (l’Excuse reste à son joueur)</span></span>
    </footer>
  </div>
</template>

<style scoped>
.peek {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(100%, 560px);
  padding: 14px 16px 16px;
  border-radius: 20px;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(255, 255, 255, 0.07), transparent 60%),
    linear-gradient(180deg, #1f4d38, #143627);
  box-shadow:
    0 0 0 3px #3a2512,
    0 0 0 4.5px #c9a463,
    0 18px 40px rgba(0, 0, 0, 0.6),
    inset 0 0 40px rgba(0, 0, 0, 0.35);
}
.cards {
  display: flex;
  justify-content: center;
  gap: clamp(6px, 2.2vw, 14px);
}
.card-slot {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 0 1 92px;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  animation: deal-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--delay);
}
.order {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.45);
}
.card-box {
  position: relative;
  width: 100%;
  aspect-ratio: var(--table-card-ratio, 61 / 112);
  border-radius: 6%;
  box-shadow: 0 0 0 2px var(--seat), 0 6px 14px rgba(0, 0, 0, 0.5);
  transition: transform 200ms;
}
.card-slot--winner .card-box {
  transform: translateY(-6px);
  box-shadow: 0 0 0 2.5px #f2d79a, 0 0 18px rgba(242, 215, 154, 0.55), 0 8px 16px rgba(0, 0, 0, 0.55);
}
.crown {
  position: absolute;
  top: -14px;
  left: 50%;
  z-index: 2;
  width: 22px;
  height: 22px;
  transform: translateX(-50%);
  color: #f2d79a;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
}
.called {
  position: absolute;
  right: 0;
  bottom: 8%;
  left: 0;
  z-index: 2;
  padding: 1px 0;
  background: #2f8fb0;
  color: white;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}
.who {
  display: flex;
  max-width: 100%;
  align-items: center;
  gap: 4px;
  padding: 2px 7px 2px 2px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.35);
  box-shadow: inset 0 0 0 1.5px var(--seat);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}
.avatar {
  display: grid;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  place-items: center;
  overflow: hidden;
  border-radius: 9999px;
  background: var(--seat);
  color: #1b1b1b;
  font-size: 9px;
  font-weight: 800;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }

@keyframes deal-in {
  from { opacity: 0; transform: translateY(14px) rotate(4deg); }
}

@media (max-height: 520px) {
  .peek { gap: 8px; padding: 10px 14px 12px; }
  .card-slot { flex-basis: 78px; }
}
@media (prefers-reduced-motion: reduce) {
  .card-slot { animation: none; }
}
</style>
