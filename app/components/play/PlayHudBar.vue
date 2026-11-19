<script setup lang="ts">
import type { Contract, PublicGameView } from '~~/shared/tarot'
import { tarotPhaseLabel } from '~/utils/tarotPhaseLabel'
import { contractLabels } from '~/utils/tarotContracts'
import { tarotCardLabel } from '~/utils/tarotCardLabel'

const props = defineProps<{
  state: PublicGameView
  localSeat: number | null
  degraded?: boolean
  /** Game socket down: the app is reconnecting on its own. */
  offline?: boolean
  /** The local player holds the called king: the taker's (secret) partner. */
  calledPartner?: boolean
}>()

const emit = defineEmits<{
  leave: []
}>()

const takerSeat = computed(() => props.state.bid?.seat ?? null)
const contract = computed<Contract | null>(() => props.state.bid?.contract ?? null)

const phase = computed(() => {
  if (props.state.phase === 'Trick' && !props.state.trick?.length && props.state.lastTrick?.length) {
    return 'Fin de pli'
  }
  return tarotPhaseLabel(props.state.phase)
})

const showTurn = computed(() => ['Bidding', 'Trick', 'ReadyToPlay', 'DogEcarta'].includes(props.state.phase))

const takerName = computed(() => {
  if (takerSeat.value === null) {
    return null
  }
  return takerSeat.value === props.localSeat ? 'Vous' : props.state.seats[takerSeat.value]?.name ?? null
})

/** 5 players: the king the taker called, shown as soon as it is known. */
const calledKing = computed(() => props.state.calledKing ? tarotCardLabel(props.state.calledKing) : null)

/**
 * Phones (narrow or landscape): scores fold away behind a button so the
 * table keeps the space; wider screens always show them.
 */
const compact = useMediaQuery('(max-width: 639px), (max-height: 520px)')
const scoresOpen = shallowRef(false)
const showScores = computed(() => !compact.value || scoresOpen.value)

const goal = computed(() => props.state.endMode === 'threshold'
  ? `${props.state.endValue} pts`
  : `${props.state.dealIndex + 1}/${props.state.endValue}`)
</script>

<template>
  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 short:flex-row short:items-start short:gap-3">
    <!-- Leave + what is being played -->
    <div class="flex min-w-0 items-center gap-2.5 sm:shrink-0 short:shrink-0">
      <UTooltip text="Quitter la table">
        <UButton
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          square
          class="size-9 shrink-0 rotate-180 justify-center rounded-full bg-black/40 text-white/80 ring-1 ring-white/10 backdrop-blur-md hover:bg-black/60 hover:text-white"
          aria-label="Quitter la table"
          @click="emit('leave')"
        />
      </UTooltip>
      <div class="min-w-0">
        <p class="truncate font-display text-xl leading-none text-amber-50 short:text-lg">
          {{ contract ? contractLabels[contract] : phase }}
        </p>
        <p class="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-white/60 short:mt-0.5">
          <template v-if="takerName">
            <UIcon
              name="i-lucide-crown"
              class="size-3 shrink-0 text-amber-300"
            />
            <span class="truncate">{{ takerName }}</span>
            <template v-if="calledKing">
              <span class="text-white/30">·</span>
              <span class="shrink-0">appelle</span>
              <span
                class="shrink-0 rounded bg-[#f7f1e6] px-1 font-bold leading-tight"
                :class="calledKing.color === 'red' ? 'text-red-700' : 'text-stone-900'"
              >{{ calledKing.shortLabel }}</span>
            </template>
          </template>
          <span
            v-else
            class="truncate text-[10px] tracking-[0.14em] text-white/50 uppercase"
          >Donne {{ state.dealIndex + 1 }} · {{ goal }}</span>
        </p>
      </div>
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="scale-90 opacity-0"
      >
        <span
          v-if="calledPartner"
          class="flex shrink-0 items-center gap-1 rounded-md bg-sky-400/20 px-2 py-1 text-xs font-semibold text-sky-100 ring-1 ring-sky-300/50"
          title="Vous avez le roi appelé : vous jouez avec le preneur. Les autres ne le savent pas encore."
        >
          <UIcon
            name="i-lucide-handshake"
            class="size-3.5"
          />
          Vous êtes appelé
        </span>
      </Transition>
      <div class="ml-auto flex shrink-0 items-center gap-2">
        <span
          v-if="offline"
          class="flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-200 ring-1 ring-amber-300/30"
          role="status"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-3.5 animate-spin"
          />
          Reconnexion…
        </span>
        <UTooltip
          v-else-if="degraded"
          text="Synchronisation partielle : la partie continue via le serveur de jeu."
        >
          <div class="grid size-8 place-items-center rounded-full bg-amber-500/15 text-amber-300 ring-1 ring-amber-300/30">
            <UIcon
              name="i-lucide-wifi-off"
              class="size-4"
            />
          </div>
        </UTooltip>
        <UButton
          v-if="compact"
          :icon="scoresOpen ? 'i-lucide-chevron-up' : 'i-lucide-trophy'"
          :label="scoresOpen ? undefined : 'Scores'"
          color="neutral"
          variant="ghost"
          size="sm"
          class="rounded-lg bg-black/40 text-white/80 ring-1 ring-white/10 backdrop-blur-md hover:bg-black/60 hover:text-white"
          :aria-expanded="scoresOpen"
          :aria-label="scoresOpen ? 'Masquer les scores' : 'Afficher les scores'"
          @click="scoresOpen = !scoresOpen"
        />
      </div>
    </div>

    <!-- Scores: on demand on phones, always on wider screens -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="-translate-y-2 opacity-0"
    >
      <ol
        v-if="showScores"
        class="grid min-w-0 auto-cols-fr grid-flow-col gap-1.5 sm:ml-auto sm:flex sm:justify-end short:ml-auto short:flex short:justify-end"
      >
        <li
          v-for="(seat, index) in state.seats"
          :key="seat.seatId"
          class="min-w-0 rounded-xl px-2.5 py-1.5 ring-1 backdrop-blur-md transition-colors sm:min-w-24 short:min-w-20 short:py-1"
          :class="showTurn && state.currentSeat === index
            ? 'bg-amber-300/15 ring-amber-300/60'
            : 'bg-black/40 ring-white/10'"
        >
          <p
            class="flex min-w-0 items-center gap-1 text-[11px] leading-tight"
            :class="localSeat === index ? 'text-amber-200' : 'text-white/60'"
          >
            <span
              v-if="showTurn && state.currentSeat === index"
              class="size-1.5 shrink-0 rounded-full bg-amber-300"
              aria-label="À son tour"
            />
            <span class="truncate">{{ localSeat === index ? 'Vous' : seat.name }}</span>
            <UIcon
              v-if="seat.userId && !seat.connected && seat.controlledBy === 'human'"
              name="i-lucide-wifi-off"
              class="size-3 shrink-0 text-white/40"
              aria-label="Déconnecté"
            />
            <UIcon
              v-else-if="seat.userId && !seat.connected && seat.controlledBy === 'bot'"
              name="i-lucide-bot"
              class="size-3 shrink-0 text-sky-300/70"
              aria-label="Remplacé par un robot"
            />
            <UIcon
              v-if="takerSeat === index"
              name="i-lucide-crown"
              class="size-3 shrink-0 text-amber-300"
              aria-label="Preneur"
            />
            <UIcon
              v-else-if="state.partnerSeat === index"
              name="i-lucide-handshake"
              class="size-3 shrink-0 text-sky-300"
              aria-label="Partenaire"
            />
          </p>
          <p class="mt-0.5 flex items-baseline gap-1 leading-none whitespace-nowrap">
            <span class="text-base font-semibold text-white tabular-nums">{{ state.scores[index] ?? 0 }}</span>
            <span
              v-if="state.tricksWonBySeat?.[index]"
              class="text-[10px] text-white/45 tabular-nums"
            >{{ state.tricksWonBySeat[index] }} pli{{ state.tricksWonBySeat[index]! > 1 ? 's' : '' }}</span>
          </p>
        </li>
      </ol>
    </Transition>
  </div>
</template>
