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

    <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-xl bg-neutral-950/70 p-1 ring-1 ring-white/10 backdrop-blur-xl">
      <div class="shrink-0 px-2.5 py-1">
        <p class="text-[11px] tracking-wide text-white/50 uppercase">
          Donne {{ state.dealIndex + 1 }} · {{ goal }}
        </p>
        <p class="text-sm font-medium whitespace-nowrap text-white">
          {{ contract ? contractLabels[contract] : phase }}
        </p>
      </div>

      <div class="mx-1 h-8 w-px shrink-0 bg-white/10" />

      <div
        v-for="(seat, index) in state.seats"
        :key="seat.seatId"
        class="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1 transition-colors"
        :class="[
          showTurn && state.currentSeat === index ? 'bg-white/10 ring-1 ring-amber-300/60' : '',
          localSeat === index ? 'text-amber-100' : 'text-white/80'
        ]"
      >
        <div class="relative">
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
        <div class="leading-tight">
          <p class="max-w-20 truncate text-xs">
            {{ localSeat === index ? 'Vous' : seat.name }}
          </p>
          <p class="text-sm font-semibold text-white tabular-nums">
            {{ state.scores[index] ?? 0 }}
          </p>
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
