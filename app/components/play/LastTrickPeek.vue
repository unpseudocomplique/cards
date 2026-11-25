<script setup lang="ts">
import type { CardId, PublicGameView } from '~~/shared/tarot'
import { cardPoints, describeTrick } from '~~/shared/tarot'
import { seatColor } from '~/utils/seatColors'
import { seatAvatar } from '~/utils/seatAvatar'

/**
 * The previous trick, brought back on a small sheet of felt: the cards in the
 * order they were laid, who laid each one, who took it and what it was worth.
 * At the end of a deal (dealTricks), every trick of the deal can be gone
 * through, one after the other, starting from the last one.
 */
const props = defineProps<{
  state: PublicGameView
  localSeat: number | null
  faceUrlFor: (card: CardId) => string | null
}>()

const emit = defineEmits<{ close: [] }>()

/** End of the deal: the whole deal to browse. */
const dealTricks = computed(() => props.state.dealTricks ?? [])
const browsing = computed(() => dealTricks.value.length > 0)
const index = shallowRef(Math.max(0, dealTricks.value.length - 1))
watch(() => dealTricks.value.length, (length) => {
  index.value = Math.max(0, length - 1)
})

const shown = computed(() => browsing.value
  ? dealTricks.value[index.value] ?? null
  : props.state.previousTrick ?? null)
const trick = computed(() => shown.value?.cards ?? [])
const winnerSeat = computed(() => shown.value?.winnerSeat ?? null)

/** Tricks played so far in this deal; the one shown is the last of them. */
const trickNumber = computed(() => browsing.value
  ? index.value + 1
  : props.state.tricksWonBySeat.reduce((sum, count) => sum + count, 0))
const isLastOfDeal = computed(() => browsing.value && index.value === dealTricks.value.length - 1)

function go(step: number) {
  if (!browsing.value) {
    return
  }
  index.value = Math.min(dealTricks.value.length - 1, Math.max(0, index.value + step))
}

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
const excuseKept = computed(() => !isLastOfDeal.value)
const points = computed(() => {
  const total = trick.value.reduce((sum, entry) => {
    if (excuseKept.value && entry.card === 'excuse' && entry.seat !== winnerSeat.value) {
      return sum
    }
    return sum + cardPoints(entry.card)
  }, 0)
  const text = Number.isInteger(total) ? String(total) : `${Math.floor(total)}½`.replace(/^0½$/, '½')
  return `${text} ${total < 2 ? 'point' : 'points'}`
})

const hasExcuse = computed(() => excuseKept.value && trick.value.some(entry => entry.card === 'excuse' && entry.seat !== winnerSeat.value))

const calledKing = computed(() => props.state.calledKing ?? null)

onKeyStroke('Escape', () => emit('close'))
onKeyStroke('ArrowLeft', () => go(-1))
onKeyStroke('ArrowRight', () => go(1))

/* Swipe between tricks on a phone. */
const sheet = useTemplateRef<HTMLElement>('sheet')
const { direction, lengthX } = useSwipe(sheet, {
  threshold: 40,
  onSwipeEnd() {
    if (Math.abs(lengthX.value) < 40) {
      return
    }
    if (direction.value === 'left') {
      go(1)
    } else if (direction.value === 'right') {
      go(-1)
    }
  }
})
</script>

<template>
  <div
    ref="sheet"
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
          {{ browsing ? (isLastOfDeal ? 'Dernier pli' : 'Pli') : 'Pli précédent' }}
          <span
            v-if="trickNumber"
            class="ml-1 text-sm text-[#e0c06a]/80"
          >n° {{ trickNumber }}<template v-if="browsing"> / {{ dealTricks.length }}</template></span>
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

    <ol
      :key="trickNumber"
      class="cards"
    >
      <li
        v-for="(entry, order) in trick"
        :key="`${entry.seat}-${entry.card}`"
        class="card-slot"
        :class="{ 'card-slot--winner': entry.seat === winnerSeat }"
        :style="{ '--seat': seatColor(entry.seat), '--delay': `${order * 45}ms` }"
      >
        <span class="order">{{ order + 1 }}</span>
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

    <nav
      v-if="browsing && dealTricks.length > 1"
      class="flex items-center justify-between gap-2"
      aria-label="Plis de la donne"
    >
      <PlayGameButton
        icon="i-lucide-chevron-left"
        label="Précédent"
        variant="felt"
        size="sm"
        :disabled="index === 0"
        @click="go(-1)"
      />
      <ol class="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1">
        <li
          v-for="(item, position) in dealTricks"
          :key="position"
        >
          <button
            type="button"
            class="dot"
            :class="{ 'dot--on': position === index }"
            :style="{ '--seat': seatColor(item.winnerSeat) }"
            :aria-label="`Pli n° ${position + 1}`"
            :aria-current="position === index ? 'step' : undefined"
            @click="index = position"
          />
        </li>
      </ol>
      <PlayGameButton
        trailing-icon="i-lucide-chevron-right"
        label="Suivant"
        variant="felt"
        size="sm"
        :disabled="index === dealTricks.length - 1"
        @click="go(1)"
      />
    </nav>
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
.dot {
  display: block;
  width: 9px;
  height: 9px;
  border-radius: 9999px;
  background: var(--seat);
  opacity: 0.45;
  transition: transform 150ms, opacity 150ms;
}
.dot--on {
  opacity: 1;
  transform: scale(1.45);
  box-shadow: 0 0 0 1.5px #f2d79a;
}

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
