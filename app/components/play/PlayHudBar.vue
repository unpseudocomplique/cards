<script setup lang="ts">
import type { Contract, PublicGameView } from '~~/shared/tarot'
import { tarotPhaseLabel } from '~/utils/tarotPhaseLabel'
import { contractLabels } from '~/utils/tarotContracts'

const props = defineProps<{
  state: PublicGameView
  localSeat: number | null
  degraded?: boolean
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

const goal = computed(() => props.state.endMode === 'threshold'
  ? `${props.state.endValue} pts`
  : `${props.state.dealIndex + 1}/${props.state.endValue}`)
</script>

<template>
  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 short:flex-row short:items-center short:gap-3">
    <!-- Leave + what is being played -->
    <div class="flex min-w-0 shrink-0 items-center gap-2.5">
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
        <p class="mt-1 truncate text-[10px] tracking-[0.14em] text-white/50 uppercase short:mt-0.5">
          Donne {{ state.dealIndex + 1 }} · {{ goal }}
        </p>
      </div>
      <UTooltip
        v-if="degraded"
        text="Synchronisation partielle : la partie continue via le serveur de jeu."
      >
        <div class="ml-auto grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-300 ring-1 ring-amber-300/30 sm:hidden short:hidden">
          <UIcon
            name="i-lucide-wifi-off"
            class="size-4"
          />
        </div>
      </UTooltip>
    </div>

    <!-- Scores: an even row on phones, chips on wider screens -->
    <ol class="grid min-w-0 auto-cols-fr grid-flow-col gap-1.5 sm:ml-auto sm:flex sm:justify-end short:ml-auto short:flex short:justify-end">
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

    <UTooltip
      v-if="degraded"
      text="Synchronisation partielle : la partie continue via le serveur de jeu."
    >
      <div class="hidden size-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-300 ring-1 ring-amber-300/30 backdrop-blur-md sm:grid short:grid">
        <UIcon
          name="i-lucide-wifi-off"
          class="size-4"
        />
      </div>
    </UTooltip>
  </div>
</template>
