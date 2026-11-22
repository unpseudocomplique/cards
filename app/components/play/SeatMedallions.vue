<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import type { PublicGameView } from '~~/shared/tarot'
import { contractLabels } from '~/utils/tarotContracts'
import { medallionSize, seatMedallion } from '~/utils/seatLayout'
import { seatAvatar } from '~/utils/seatAvatar'
import { seatColor } from '~/utils/seatColors'

/**
 * Every player as a round portrait on the edge of the felt: their role
 * (taker, partner, defence), the cards left in their hand, the called king
 * beside the taker, a golden ring turning around whoever must play, what
 * they bid, and their points flying in at the end of the deal.
 */
const props = defineProps<{
  state: PublicGameView
  localSeat: number
  sceneWidth: number
  sceneHeight: number
  mobile: boolean
  /** Seat whose turn it is. */
  activeSeat?: number | null
  /** Seat that just won the trick (pulse while the cards fly in). */
  highlightSeat?: number | null
  /** 5 players: the local player secretly holds the called king. */
  calledPartner?: boolean
  faceUrls?: Map<string, string | null>
}>()

const view = computed(() => ({ width: props.sceneWidth, height: props.sceneHeight, mobile: props.mobile }))
const size = computed(() => medallionSize(view.value))

const openSeat = shallowRef<number | null>(null)
function toggleSeat(seat: number) {
  openSeat.value = openSeat.value === seat ? null : seat
}

const playing = computed(() => ['ReadyToPlay', 'Trick', 'DogEcarta'].includes(props.state.phase))
const scoring = computed(() => props.state.phase === 'Scoring')

type Role = 'taker' | 'partner' | 'defense' | null

function roleOf(seat: number): Role {
  const bid = props.state.bid
  if (!bid || props.state.phase === 'Bidding' || props.state.phase === 'Cutting') {
    return null
  }
  if (bid.seat === seat) {
    return 'taker'
  }
  const partner = props.state.partnerSeat ?? (props.calledPartner ? props.localSeat : undefined)
  if (partner === seat) {
    return 'partner'
  }
  // 5 players: until the king shows up, only you know your own camp.
  if (props.state.playerCount === 5 && props.state.partnerSeat == null && !scoring.value) {
    return seat === props.localSeat ? 'defense' : null
  }
  return 'defense'
}

const roleMeta = {
  taker: { icon: 'i-lucide-sword', label: 'Preneur', cls: 'medal-role--taker' },
  partner: { icon: 'i-lucide-handshake', label: 'Appelé', cls: 'medal-role--partner' },
  defense: { icon: 'i-lucide-shield', label: 'Défense', cls: 'medal-role--defense' }
} as const

function lastBid(seat: number) {
  if (props.state.phase !== 'Bidding') {
    return null
  }
  const entry = [...props.state.bidSpoken].reverse().find(item => item.seat === seat)
  if (!entry) {
    return null
  }
  return entry.bid === 'passe' ? { label: 'Passe', pass: true } : { label: contractLabels[entry.bid], pass: false }
}

const players = computed(() => props.state.seats.map((seat, index) => {
  const local = index === props.localSeat
  const point = seatMedallion(index, props.localSeat, props.state.playerCount, view.value)
  const delta = scoring.value ? Number(props.state.lastDeltas?.[index] ?? 0) : null
  return {
    seat: index,
    local,
    x: point.x,
    y: point.y,
    name: local ? 'Vous' : seat.name || `Joueur ${index + 1}`,
    avatar: seatAvatar(seat),
    bot: seat.controlledBy === 'bot',
    offline: Boolean(seat.userId) && !seat.connected && seat.controlledBy === 'human',
    role: roleOf(index),
    cards: !local && playing.value ? props.state.handCounts[index] ?? 0 : null,
    king: props.state.calledKing && props.state.bid?.seat === index && props.state.phase !== 'Bidding' ? props.state.calledKing : null,
    bid: lastBid(index),
    delta,
    right: point.x > props.sceneWidth * 0.6,
    // Your own portrait is a little smaller: the hand is yours already.
    size: local ? Math.round(size.value * 0.86) : size.value
  }
}))

const kingFace = computed(() => props.state.calledKing ? props.faceUrls?.get(props.state.calledKing) ?? null : null)
const prefersReduced = usePreferredReducedMotion()
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-[28]">
    <div
      v-for="player in players"
      :key="player.seat"
      class="medal"
      :class="{ 'medal--turn': activeSeat === player.seat, 'medal--won': highlightSeat === player.seat }"
      :style="{ 'left': `${player.x}px`, 'top': `${player.y}px`, '--medal': `${player.size}px`, '--seat': seatColor(player.seat) }"
    >
      <button
        type="button"
        class="medal-face pointer-events-auto"
        :aria-label="`${player.name} : détails`"
        :aria-expanded="openSeat === player.seat"
        @click="toggleSeat(player.seat)"
      >
        <span
          v-if="activeSeat === player.seat"
          class="medal-ring"
          aria-label="À son tour"
        />
        <img
          v-if="player.avatar.src"
          :src="player.avatar.src"
          :alt="player.name"
          class="medal-img"
          draggable="false"
          referrerpolicy="no-referrer"
        >
        <span
          v-else
          class="medal-initials"
        >{{ player.avatar.initials }}</span>

        <Transition name="medal-pop">
          <span
            v-if="player.role"
            :key="player.role"
            class="medal-role"
            :class="roleMeta[player.role].cls"
            :title="roleMeta[player.role].label"
          >
            <UIcon
              :name="roleMeta[player.role].icon"
              class="size-[60%]"
            />
          </span>
        </Transition>

        <Transition name="medal-pop">
          <span
            v-if="player.cards != null"
            class="medal-cards"
            :title="`${player.cards} carte${player.cards > 1 ? 's' : ''} en main`"
          >{{ player.cards }}</span>
        </Transition>

        <Transition name="medal-king">
          <span
            v-if="player.king"
            class="medal-king"
            title="Roi appelé"
          >
            <PlayDeckCard
              :card-id="player.king"
              :face-url="kingFace"
              fill
              :index-px="8"
            />
          </span>
        </Transition>

        <span
          v-if="player.offline"
          class="medal-status"
          title="Déconnecté"
        >
          <UIcon
            name="i-lucide-wifi-off"
            class="size-3"
          />
        </span>
      </button>

      <span class="medal-name">
        <span class="medal-dot" />
        <span class="truncate">{{ player.name }}</span>
      </span>

      <Transition name="medal-pop">
        <span
          v-if="player.bid"
          :key="player.bid.label"
          class="medal-bid"
          :class="player.bid.pass ? 'medal-bid--pass' : ''"
        >{{ player.bid.label }}</span>
      </Transition>

      <AnimatePresence>
        <motion.span
          v-if="player.delta != null"
          :key="`delta-${state.dealIndex}`"
          class="medal-delta"
          :class="[player.delta > 0 ? 'medal-delta--up' : player.delta < 0 ? 'medal-delta--down' : '', player.right ? 'medal-delta--left' : '']"
          :initial="prefersReduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.6 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }"
          :exit="{ opacity: 0, y: -10 }"
          :transition="{ type: 'spring', stiffness: 380, damping: 16, delay: prefersReduced ? 0 : 1.1 + player.seat * 0.12 }"
        >
          {{ player.delta > 0 ? `+${player.delta}` : player.delta }}
        </motion.span>
      </AnimatePresence>
    </div>

    <!-- Player sheet, over the table -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="scale-95 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="scale-95 opacity-0"
    >
      <div
        v-if="openSeat !== null"
        class="pointer-events-auto absolute inset-0 z-[60] grid place-items-center bg-black/30 px-4"
        @click.self="openSeat = null"
      >
        <PlayPlayerDetailPanel
          :state="state"
          :seat="openSeat"
          :local-seat="localSeat"
          :face-urls="faceUrls ?? new Map()"
          @close="openSeat = null"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.medal {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, calc(var(--medal) / -2));
}
.medal-face {
  position: relative;
  width: var(--medal);
  height: var(--medal);
  border-radius: 9999px;
  background: radial-gradient(circle at 40% 35%, #4a3424, #1d130c);
  box-shadow: 0 0 0 2.5px #c9a463, 0 0 0 4px #3a2512, 0 6px 14px rgba(0, 0, 0, 0.6);
  transition: transform 300ms cubic-bezier(.3, 1.5, .5, 1), box-shadow 300ms;
  -webkit-tap-highlight-color: transparent;
}
.medal-face:active { transform: scale(0.95); }
.medal--won .medal-face { transform: scale(1.12); box-shadow: 0 0 0 2.5px #ffe08a, 0 0 0 4px #3a2512, 0 0 24px 6px rgba(255, 214, 107, 0.55); }
.medal-img, .medal-initials {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  object-fit: cover;
}
.medal-initials {
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: calc(var(--medal) * 0.36);
  color: #1b1410;
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--seat) 80%, white), var(--seat));
}

/* Golden ring turning around whoever must play */
.medal-ring {
  position: absolute;
  inset: calc(var(--medal) * -0.16);
  border-radius: 9999px;
  background: conic-gradient(from 0deg, #ffd66b 0 62%, rgba(255, 214, 107, 0.08) 62% 100%);
  -webkit-mask: radial-gradient(circle, transparent 64%, #000 65.5%, #000 71%, transparent 72.5%);
  mask: radial-gradient(circle, transparent 64%, #000 65.5%, #000 71%, transparent 72.5%);
  filter: drop-shadow(0 0 6px rgba(255, 214, 107, 0.85));
  animation: medal-spin 2.4s linear infinite;
}
.medal--turn .medal-face { box-shadow: 0 0 0 2.5px #ffe08a, 0 0 0 4px #3a2512, 0 0 26px 4px rgba(255, 214, 107, 0.45); }
@keyframes medal-spin { to { transform: rotate(360deg); } }

.medal-role {
  position: absolute;
  top: -5%;
  right: -9%;
  width: 40%;
  height: 40%;
  min-width: 20px;
  min-height: 20px;
  border-radius: 9999px;
  display: grid;
  place-items: center;
  color: #fff;
  border: 2px solid #f2d79a;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.6);
}
.medal-role--taker { background: #b23a2a; }
.medal-role--partner { background: #2f8fb0; }
.medal-role--defense { background: #2d5e9c; }

.medal-cards {
  position: absolute;
  left: -22%;
  top: 18%;
  width: 34%;
  min-width: 18px;
  aspect-ratio: 2 / 3;
  border-radius: 3px;
  display: grid;
  place-items: center;
  background: repeating-linear-gradient(45deg, #6b2d4a 0 3px, #55223a 3px 6px);
  border: 1.5px solid #e8cf98;
  color: #fff;
  font-weight: 800;
  font-size: max(10px, calc(var(--medal) * 0.2));
  text-shadow: 0 1px 2px #000;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.6);
  font-variant-numeric: tabular-nums;
}

.medal-king {
  position: absolute;
  right: -26%;
  bottom: -8%;
  width: 34%;
  min-width: 18px;
  aspect-ratio: var(--table-card-ratio, 2 / 3);
  border-radius: 3px;
  overflow: hidden;
  box-shadow: 0 0 0 1.5px #4fc3f7, 0 0 10px 2px rgba(79, 195, 247, 0.55), 0 2px 5px rgba(0, 0, 0, 0.6);
  transform: rotate(10deg);
}

.medal-status {
  position: absolute;
  left: -4%;
  bottom: -2%;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  display: grid;
  place-items: center;
  background: #1d130c;
  color: #c9d8e8;
  box-shadow: 0 0 0 1.5px #c9a463;
}

.medal-name {
  margin-top: 7px;
  display: flex;
  align-items: center;
  gap: 5px;
  max-width: 7.5rem;
  padding: 1px 9px 2px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #f6e7c4;
  background: linear-gradient(#4a2c1a, #2e1a0f);
  border: 1.5px solid #c9a463;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}
.medal-dot { width: 7px; height: 7px; flex-shrink: 0; border-radius: 9999px; background: var(--seat); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5); }
.medal--turn .medal-name { background: linear-gradient(#f6d98c, #d9a845); color: #3a2208; border-color: #fff0c4; }

.medal-bid {
  margin-top: 4px;
  padding: 1px 9px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 800;
  background: #f6d98c;
  color: #3a2208;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
}
.medal-bid--pass { background: rgba(0, 0, 0, 0.55); color: rgba(255, 255, 255, 0.75); }

.medal-delta {
  position: absolute;
  left: calc(100% + 4px);
  top: calc(var(--medal) * 0.1);
  font-size: 17px;
  font-weight: 800;
  text-shadow: 0 2px 4px #000, 0 0 10px rgba(0, 0, 0, 0.6);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.medal-delta--left { left: auto; right: calc(100% + 4px); }
.medal-delta--up { color: #9df0a8; }
.medal-delta--down { color: #ff9c8a; }

.medal-pop-enter-active { transition: transform 380ms cubic-bezier(.3, 1.6, .5, 1), opacity 200ms; }
.medal-pop-leave-active { transition: transform 160ms ease-in, opacity 160ms; }
.medal-pop-enter-from, .medal-pop-leave-to { transform: scale(0.2); opacity: 0; }
.medal-king-enter-active { transition: transform 520ms cubic-bezier(.3, 1.4, .5, 1), opacity 300ms; }
.medal-king-enter-from { transform: translate(-60px, 40px) rotate(-30deg) scale(1.6); opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .medal-ring { animation: none; }
}
</style>
