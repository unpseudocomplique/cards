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
  <div class="flex items-start gap-2">
    <UTooltip text="Quitter la table">
      <UButton
        icon="i-lucide-log-out"
        color="neutral"
        variant="solid"
        size="lg"
        square
        class="shrink-0 rotate-180 rounded-xl bg-neutral-950/70 text-white ring-1 ring-white/10 backdrop-blur-xl hover:bg-neutral-900"
        aria-label="Quitter la table"
        @click="emit('leave')"
      />
    </UTooltip>

    <!-- Phones in portrait: phase on one line, scores as an even grid below. -->
    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded-xl bg-neutral-950/70 p-1 ring-1 ring-white/10 backdrop-blur-xl sm:flex-nowrap">
      <div class="flex w-full shrink-0 items-baseline justify-between gap-2 px-2.5 py-0.5 sm:w-auto sm:flex-col sm:items-start sm:gap-0 sm:py-1 short:py-0.5">
        <p class="text-sm font-medium whitespace-nowrap text-white sm:order-2">
          {{ contract ? contractLabels[contract] : phase }}
        </p>
        <p class="text-[11px] tracking-wide whitespace-nowrap text-white/50 uppercase sm:order-1">
          Donne {{ state.dealIndex + 1 }} · {{ goal }}
        </p>
      </div>

      <div class="mx-1 hidden h-8 w-px shrink-0 bg-white/10 sm:block" />

      <div
        class="grid min-w-0 flex-1 auto-cols-fr grid-flow-col gap-1 sm:flex sm:overflow-x-auto"
      >
        <div
          v-for="(seat, index) in state.seats"
          :key="seat.seatId"
          class="flex min-w-0 shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors sm:px-2 short:py-0.5"
          :class="[
            showTurn && state.currentSeat === index ? 'bg-white/10 ring-1 ring-amber-300/60' : '',
            localSeat === index ? 'text-amber-100' : 'text-white/80'
          ]"
        >
          <div class="relative hidden sm:block">
            <UAvatar
              :alt="seat.name"
              :icon="seat.controlledBy === 'bot' ? 'i-lucide-bot' : undefined"
              size="xs"
              class="bg-white/10 text-white"
            />
            <UIcon
              v-if="takerSeat === index"
              name="i-lucide-crown"
              class="absolute -top-2 -right-1.5 size-3.5 text-amber-300"
              aria-label="Preneur"
            />
            <UIcon
              v-else-if="state.partnerSeat === index"
              name="i-lucide-handshake"
              class="absolute -top-2 -right-1.5 size-3.5 text-sky-300"
              aria-label="Partenaire"
            />
          </div>
          <div class="min-w-0 leading-tight">
            <p class="flex min-w-0 items-center gap-1 text-xs">
              <span class="truncate sm:max-w-20">{{ localSeat === index ? 'Vous' : seat.name }}</span>
              <UIcon
                v-if="takerSeat === index"
                name="i-lucide-crown"
                class="size-3 shrink-0 text-amber-300 sm:hidden"
                aria-label="Preneur"
              />
              <UIcon
                v-else-if="state.partnerSeat === index"
                name="i-lucide-handshake"
                class="size-3 shrink-0 text-sky-300 sm:hidden"
                aria-label="Partenaire"
              />
            </p>
            <p class="text-sm font-semibold whitespace-nowrap text-white tabular-nums">
              {{ state.scores[index] ?? 0 }}
              <span
                v-if="state.tricksWonBySeat?.[index]"
                class="ml-0.5 text-[11px] font-normal text-white/50"
                :title="`${state.tricksWonBySeat[index]} pli${state.tricksWonBySeat[index]! > 1 ? 's' : ''} ramassé${state.tricksWonBySeat[index]! > 1 ? 's' : ''}`"
              >· {{ state.tricksWonBySeat[index] }}<span class="hidden sm:inline"> pli{{ state.tricksWonBySeat[index]! > 1 ? 's' : '' }}</span></span>
            </p>
          </div>
        </div>
      </div>
    </div>

    <UTooltip
      v-if="degraded"
      text="Synchronisation partielle : la partie continue via le serveur de jeu."
    >
      <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-300/30 backdrop-blur-xl">
        <UIcon
          name="i-lucide-wifi-off"
          class="size-4"
        />
      </div>
    </UTooltip>
  </div>
</template>
