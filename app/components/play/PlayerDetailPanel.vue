<script setup lang="ts">
import { poigneeTiers } from '~~/shared/tarot'
import type { PublicGameView } from '~~/shared/tarot'
import { contractLabels } from '~/utils/tarotContracts'
import { seatColor } from '~/utils/seatColors'

const props = defineProps<{
  state: PublicGameView
  seat: number
  localSeat: number
  faceUrls: Map<string, string | null>
}>()

const emit = defineEmits<{
  close: []
}>()

const { show: showZoom } = useCardZoom()

const info = computed(() => props.state.seats[props.seat])
const name = computed(() => props.seat === props.localSeat ? 'Vous' : info.value?.name || `Joueur ${props.seat + 1}`)

const botLevels = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' } as const

const status = computed(() => {
  const seat = info.value
  if (!seat) {
    return null
  }
  if (seat.controlledBy === 'bot') {
    const level = seat.botLevel ? ` · ${botLevels[seat.botLevel]}` : ''
    return seat.userId ? `Remplacé par un robot${level}` : `Robot${level}`
  }
  return seat.connected ? null : 'Déconnecté'
})

const role = computed(() => {
  const bid = props.state.bid
  if (!bid) {
    return null
  }
  if (bid.seat === props.seat) {
    return { label: `Preneur · ${contractLabels[bid.contract]}`, icon: 'i-lucide-sword', tone: 'text-amber-200' }
  }
  if (props.state.partnerSeat === props.seat) {
    return { label: 'Partenaire du preneur', icon: 'i-lucide-handshake', tone: 'text-sky-200' }
  }
  if (props.state.playerCount === 5 && props.state.partnerSeat == null) {
    return { label: 'Camp encore inconnu', icon: 'i-lucide-circle-help', tone: 'text-white/60' }
  }
  return { label: 'Défense', icon: 'i-lucide-shield', tone: 'text-white/70' }
})

const spoken = computed(() => {
  const entry = [...props.state.bidSpoken].reverse().find(item => item.seat === props.seat)
  if (!entry) {
    return null
  }
  return entry.bid === 'passe' ? 'Passe' : contractLabels[entry.bid]
})

const poignee = computed(() => props.state.poignees?.find(item => item.seat === props.seat) ?? null)
const poigneeLabel = computed(() => {
  if (!poignee.value) {
    return ''
  }
  const index = poigneeTiers(props.state.playerCount).indexOf(poignee.value.tier)
  return `${['Simple', 'Double', 'Triple'][index] ?? ''} poignée`
})

const stats = computed(() => [
  { label: 'Points', value: String(props.state.scores[props.seat] ?? 0) },
  { label: 'Plis', value: String(props.state.tricksWonBySeat?.[props.seat] ?? 0) },
  { label: 'En main', value: String(props.state.handCounts[props.seat] ?? 0) },
])
</script>

<template>
  <div
    class="pointer-events-auto w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-neutral-950/92 p-3.5 text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-md"
    role="dialog"
    :aria-label="`Détails de ${name}`"
  >
    <div class="flex items-start gap-2.5">
      <span
        class="mt-1 size-3 shrink-0 rounded-full ring-2 ring-black/40"
        :style="{ background: seatColor(seat) }"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate font-display text-xl leading-tight text-amber-50">
          {{ name }}
        </p>
        <p
          v-if="status"
          class="mt-0.5 flex items-center gap-1 text-xs text-white/55"
        >
          <UIcon
            :name="info?.controlledBy === 'bot' ? 'i-lucide-bot' : 'i-lucide-wifi-off'"
            class="size-3.5"
          />
          {{ status }}
        </p>
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        square
        aria-label="Fermer"
        class="-mt-1 -mr-1 text-white/60"
        @click="emit('close')"
      />
    </div>

    <p
      v-if="role"
      class="mt-2.5 flex items-center gap-1.5 text-sm font-medium"
      :class="role.tone"
    >
      <UIcon
        :name="role.icon"
        class="size-4"
      />
      {{ role.label }}
    </p>
    <p
      v-if="spoken"
      class="mt-1 text-xs text-white/55"
    >
      Enchère : {{ spoken }}
    </p>

    <dl class="mt-3 grid grid-cols-3 gap-1.5">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="rounded-lg bg-white/5 px-2 py-1.5 ring-1 ring-white/10"
      >
        <dt class="text-[10px] tracking-[0.1em] text-white/50 uppercase">
          {{ stat.label }}
        </dt>
        <dd class="text-lg leading-tight font-semibold tabular-nums">
          {{ stat.value }}
        </dd>
      </div>
    </dl>

    <div
      v-if="poignee"
      class="mt-3"
    >
      <p class="text-xs font-medium text-amber-200">
        {{ poigneeLabel }} · {{ poignee.cards.length }} atouts
      </p>
      <div class="mt-1.5 flex flex-wrap gap-1">
        <button
          v-for="card in poignee.cards"
          :key="card"
          type="button"
          class="h-12 cursor-zoom-in"
          aria-label="Agrandir la carte"
          @click="showZoom(card, faceUrls.get(card) ?? null, 'tap')"
        >
          <PlayDeckCard
            :card-id="card"
            :face-url="faceUrls.get(card) ?? null"
            fill
            :index-px="10"
          />
        </button>
      </div>
    </div>
  </div>
</template>
