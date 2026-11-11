<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'
import { countPoigneeTrumps, poigneeTiers } from '~~/shared/tarot'

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
const isHost = computed(() => Boolean(user.value && publicState.value?.seats[0]?.userId === user.value.id))
const localSeat = computed(() => privateState.value?.seat ?? null)
const phase = computed(() => publicState.value?.phase)

const myTurn = computed(() => localSeat.value !== null && publicState.value?.currentSeat === localSeat.value)
const isTaker = computed(() => localSeat.value !== null && publicState.value?.bid?.seat === localSeat.value)

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

/* Poignée — only before the first card of the deal. */
const poigneeTier = computed(() => {
  if (phase.value !== 'ReadyToPlay' || publicState.value?.poigneeShown || !privateState.value) {
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

/* Orientation */
const debugGfx = computed(() => String(route.query.debugGfx ?? '') === '1')
const tableActive = computed(() => Boolean(publicState.value) && !isLobby.value)
const { isPhonePortrait, tryLockLandscape } = usePlayOrientation(tableActive)
const needsLandscape = computed(() => tableActive.value && isPhonePortrait.value)

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
  <PlayRotatePrompt
    v-if="needsLandscape"
    @retry="tryLockLandscape"
  />

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

    <!-- HUD -->
    <div class="pointer-events-none absolute inset-0 z-40 flex flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
      <div class="pointer-events-auto mx-auto w-full max-w-5xl">
        <PlayHudBar
          :state="publicState"
          :local-seat="localSeat"
          :degraded="publicSyncDegraded"
          @leave="leaveOpen = true"
        />
      </div>

      <div
        v-if="phase === 'Bidding'"
        class="pointer-events-auto mt-3 w-full"
      >
        <PlayBidDock
          :state="publicState"
          :my-turn="myTurn"
          :local-seat="localSeat"
          @bid="sendIntent({ type: 'bid', bid: $event })"
        />
      </div>

      <div
        v-if="poigneeTier"
        class="pointer-events-auto mx-auto mt-3"
      >
        <UButton
          :label="`Annoncer : ${poigneeName}`"
          icon="i-lucide-hand"
          color="warning"
          variant="solid"
          class="rounded-full shadow-lg"
          @click="sendIntent({ type: 'announcePoignee', tier: poigneeTier })"
        />
      </div>

      <div
        v-if="needsKingCall || canDiscard || showSummary"
        class="pointer-events-auto m-auto w-full max-w-2xl py-3"
      >
        <PlayKingCallPanel
          v-if="needsKingCall"
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
