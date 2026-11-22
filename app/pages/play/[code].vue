<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'
import { countPoigneeTrumps, poigneeTiers } from '~~/shared/tarot'
import { tarotCardLabel } from '~/utils/tarotCardLabel'

definePageMeta({
  middleware: 'auth',
  layout: 'play',
  colorMode: 'dark'
})

const route = useRoute()
const config = useRuntimeConfig()
const toast = useToast()
const { user } = useUserSession()

const code = computed(() => String(route.params.code ?? '').toUpperCase())

useSeoMeta({
  title: () => `Table ${code.value}`
})

const {
  publicState,
  privateState,
  connected,
  error,
  publicSyncDegraded,
  sendIntent,
  join
} = useTarotGame(code)

const { faceUrlFor, cardRatio } = useDeckFaceUrls(code)

/* Seating */
const joined = shallowRef(false)
const alreadySeated = computed(() => {
  const userId = user.value?.id
  return Boolean(userId && publicState.value?.seats.some(seat => seat.userId === userId))
})

watch([connected, publicState, privateState], () => {
  if (!connected.value || joined.value) {
    return
  }
  // The host is seated when the table is created; only guests need to join.
  if (alreadySeated.value || privateState.value) {
    joined.value = true
    return
  }
  if (publicState.value) {
    join()
    joined.value = true
  }
})

const inviteUrl = computed(() => `${String(config.public.siteUrl).replace(/\/$/, '')}/play/${code.value}`)
const isLobby = computed(() => publicState.value?.phase === 'Lobby')
/**
 * After a refresh mid-game the public table arrives before our own seat and
 * hand: wait for them instead of drawing the table from seat 0 without a hand.
 */
const rejoining = computed(() => Boolean(publicState.value && !isLobby.value && alreadySeated.value && !privateState.value))
const isHost = computed(() => Boolean(user.value && publicState.value?.seats[0]?.userId === user.value.id))
const localSeat = computed(() => privateState.value?.seat ?? null)
const phase = computed(() => publicState.value?.phase)

const myTurn = computed(() => localSeat.value !== null && publicState.value?.currentSeat === localSeat.value)
const isTaker = computed(() => localSeat.value !== null && publicState.value?.bid?.seat === localSeat.value)

/**
 * 5 players: the local player holds the called king (or already played it),
 * so they are the taker's secret partner. Only they can see it.
 */
const isCalledPartner = computed(() => {
  const king = publicState.value?.calledKing
  if (!king || isTaker.value || localSeat.value === null) {
    return false
  }
  return Boolean(privateState.value?.hand?.includes(king)) || publicState.value?.partnerSeat === localSeat.value
})

const needsKingCall = computed(() =>
  publicState.value?.playerCount === 5
  && isTaker.value
  && !publicState.value.calledKing
  && (phase.value === 'DogEcarta' || phase.value === 'ReadyToPlay')
)

const discardSize = computed<3 | 6>(() => publicState.value?.playerCount === 5 ? 3 : 6)
const canDiscard = computed(() => phase.value === 'DogEcarta' && isTaker.value && Boolean(privateState.value) && !needsKingCall.value)
const showSummary = computed(() => phase.value === 'Scoring' || phase.value === 'MatchOver')

const showHand = computed(() =>
  Boolean(privateState.value?.hand?.length)
  && !canDiscard.value
  && !needsKingCall.value
  && !showSummary.value
  && phase.value !== 'Dealing'
)

/* Poignée — FFT: shown just before playing one's own first card. */
const FULL_HAND: Record<number, number> = { 3: 24, 4: 18, 5: 15 }
const poigneeTier = computed(() => {
  if ((phase.value !== 'ReadyToPlay' && phase.value !== 'Trick') || !myTurn.value || !privateState.value || !publicState.value) {
    return null
  }
  if (needsKingCall.value || publicState.value.poignees?.some(entry => entry.seat === localSeat.value)) {
    return null
  }
  if (privateState.value.hand.length !== FULL_HAND[publicState.value.playerCount]) {
    return null
  }
  const count = countPoigneeTrumps(privateState.value.hand)
  const eligible = poigneeTiers(publicState.value!.playerCount).filter(tier => count >= tier)
  return eligible.at(-1) ?? null
})

const poigneeLabels = ['Simple', 'Double', 'Triple']
const poigneeName = computed(() => {
  if (!poigneeTier.value || !publicState.value) {
    return ''
  }
  const index = poigneeTiers(publicState.value.playerCount).indexOf(poigneeTier.value)
  return `${poigneeLabels[index] ?? ''} poignée (${poigneeTier.value} atouts)`
})

/* Cards shown to the table: poignées and trumps put in the écart (FFT). */
function cardList(cards: CardId[]) {
  return cards.map(card => tarotCardLabel(card).shortLabel).join(', ')
}

function seatName(seat: number) {
  return seat === localSeat.value ? 'Vous' : (publicState.value?.seats[seat]?.name ?? `Joueur ${seat + 1}`)
}

watch(() => publicState.value?.poignees?.length ?? 0, (count, previous) => {
  const poignees = publicState.value?.poignees ?? []
  for (const entry of poignees.slice(previous ?? 0, count)) {
    const index = poigneeTiers(publicState.value!.playerCount).indexOf(entry.tier)
    toast.add({
      title: `${seatName(entry.seat)} : ${(poigneeLabels[index] ?? '').toLowerCase()} poignée`,
      description: cardList(entry.cards),
      icon: 'i-lucide-hand',
      color: 'warning',
      duration: 10000
    })
  }
})

watch(() => publicState.value?.ecartShownTrumps?.join(','), (key) => {
  const trumps = publicState.value?.ecartShownTrumps
  const takerSeat = publicState.value?.bid?.seat
  if (!key || !trumps?.length || takerSeat === undefined) {
    return
  }
  toast.add({
    title: `Atouts mis à l'écart par ${takerSeat === localSeat.value ? 'vous' : seatName(takerSeat)}`,
    description: cardList(trumps),
    icon: 'i-lucide-eye',
    color: 'warning',
    duration: 10000
  })
})

/* Chelem — FFT: the taker announces it before the first card, then leads. */
const chelemOpen = shallowRef(false)
const canAnnounceChelem = computed(() =>
  phase.value === 'ReadyToPlay'
  && isTaker.value
  && !needsKingCall.value
  && !publicState.value?.chelemAnnounce
)

function announceChelem() {
  chelemOpen.value = false
  sendIntent({ type: 'announceChelem', kind: 'announced' })
}

watch(() => publicState.value?.chelemAnnounce, (kind, previous) => {
  const takerSeat = publicState.value?.bid?.seat
  if (kind !== 'announced' || previous === 'announced' || takerSeat === undefined) {
    return
  }
  toast.add({
    title: takerSeat === localSeat.value ? 'Vous annoncez un chelem' : `${seatName(takerSeat)} annonce un chelem`,
    description: 'Le preneur doit remporter tous les plis. Il entame.',
    icon: 'i-lucide-crown',
    color: 'warning',
    duration: 10000
  })
})

const debugGfx = computed(() => String(route.query.debugGfx ?? '') === '1')

/* Errors as toasts rather than banners covering the table. */
watch(error, (message) => {
  if (message) {
    toast.add({ title: message, color: 'error', icon: 'i-lucide-circle-alert', duration: 5000 })
  }
})

/* Leave */
const leaveOpen = shallowRef(false)

function leaveTable() {
  leaveOpen.value = false
  return navigateTo('/play')
}

function play(card: CardId) {
  sendIntent({ type: 'playCard', card })
}
</script>

<template>
  <div
    v-if="rejoining"
    class="grid h-dvh w-full place-items-center bg-neutral-950 text-white/70"
    role="status"
  >
    <p class="flex items-center gap-2 text-sm">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-4 animate-spin"
      />
      Retour à la table…
    </p>
  </div>

  <div
    v-else-if="publicState && !isLobby"
    class="relative h-dvh w-full overflow-hidden overscroll-none bg-neutral-950"
    :style="{ '--table-card-ratio': cardRatio }"
  >
    <PlayTresTableScene
      class="absolute inset-0"
      :code="code"
      :public-state="publicState"
      :private-state="privateState"
      :debug-gfx="debugGfx"
      :show-hand="showHand"
      @play="play"
    />

    <!-- Soft shade behind the HUD so it reads without a heavy panel -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-30 h-36 bg-gradient-to-b from-black/75 via-black/35 to-transparent short:h-24" />

    <!-- HUD -->
    <div class="pointer-events-none absolute inset-0 z-40 flex flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 short:pt-[max(0.5rem,env(safe-area-inset-top))] short:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div class="pointer-events-auto mx-auto w-full max-w-5xl">
        <PlayHudBar
          :state="publicState"
          :local-seat="localSeat"
          :degraded="publicSyncDegraded"
          :offline="!connected"
          :called-partner="isCalledPartner"
          @leave="leaveOpen = true"
        />
      </div>

      <div
        v-if="phase === 'Bidding'"
        class="pointer-events-auto mt-3 w-full short:mt-2"
      >
        <PlayBidDock
          :state="publicState"
          :my-turn="myTurn"
          :local-seat="localSeat"
          @bid="sendIntent({ type: 'bid', bid: $event })"
        />
      </div>

      <div
        v-if="poigneeTier || canAnnounceChelem"
        class="pointer-events-auto mx-auto mt-3 flex flex-wrap justify-center gap-2"
      >
        <UButton
          v-if="poigneeTier"
          :label="`Annoncer : ${poigneeName}`"
          icon="i-lucide-hand"
          color="warning"
          variant="solid"
          class="rounded-full shadow-lg"
          @click="sendIntent({ type: 'announcePoignee', tier: poigneeTier })"
        />
        <UButton
          v-if="canAnnounceChelem"
          label="Annoncer un chelem"
          icon="i-lucide-crown"
          color="warning"
          variant="outline"
          class="rounded-full bg-black/40 shadow-lg"
          @click="chelemOpen = true"
        />
      </div>

      <div
        v-if="needsKingCall || canDiscard || showSummary"
        class="pointer-events-auto m-auto w-full max-w-2xl py-3 short:max-w-4xl short:py-1"
      >
        <PlayKingCallPanel
          v-if="needsKingCall"
          :hand="privateState?.hand ?? []"
          :face-url-for="faceUrlFor"
          @call="sendIntent({ type: 'callKing', king: $event })"
        />
        <PlayDiscardPanel
          v-else-if="canDiscard && privateState"
          :hand="privateState.hand"
          :size="discardSize"
          :face-url-for="faceUrlFor"
          @discard="sendIntent({ type: 'discard', cards: $event })"
        />
        <PlayDealSummary
          v-else-if="showSummary"
          :state="publicState"
          :local-seat="localSeat"
          @continue="sendIntent({ type: 'continue' })"
        />
      </div>
    </div>

    <UModal
      v-model:open="chelemOpen"
      title="Annoncer un chelem ?"
      description="Vous vous engagez à remporter tous les plis. Réussi : +400 points. Raté : −200 points. Vous entamez le premier pli."
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer="{ close }">
        <UButton
          label="Annuler"
          color="neutral"
          variant="ghost"
          @click="close"
        />
        <UButton
          label="Annoncer"
          color="warning"
          icon="i-lucide-crown"
          @click="announceChelem"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="leaveOpen"
      title="Quitter la table ?"
      description="La partie continue sans vous. Vous pourrez revenir avec le même lien."
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer="{ close }">
        <UButton
          label="Rester"
          color="neutral"
          variant="ghost"
          @click="close"
        />
        <UButton
          label="Quitter"
          color="error"
          icon="i-lucide-log-out"
          @click="leaveTable"
        />
      </template>
    </UModal>
  </div>

  <PlayLobby
    v-else
    :code="code"
    :state="publicState"
    :connected="connected"
    :is-host="isHost"
    :invite-url="inviteUrl"
    @add-bot="sendIntent({ type: 'addBot' })"
    @remove-bot="sendIntent({ type: 'removeBot', seat: $event })"
    @start="sendIntent({ type: 'start' })"
  />
</template>
