<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'

definePageMeta({
  middleware: 'auth',
  layout: 'play',
})

const route = useRoute()
const config = useRuntimeConfig()
const toast = useToast()
const { user } = useUserSession()

const code = computed(() => String(route.params.code ?? ''))

useSeoMeta({
  title: () => `Partie ${code.value}`,
})

const {
  publicState,
  privateState,
  connected,
  error,
  publicSyncDegraded,
  sendIntent,
  join,
} = useTarotGame(code)

const joined = shallowRef(false)

const alreadySeated = computed(() => {
  const userId = user.value?.id
  if (!userId || !publicState.value) {
    return false
  }
  return publicState.value.seats.some(seat => seat.userId === userId)
})

function tryJoin() {
  if (!connected.value || joined.value) {
    return
  }
  // Host is seated at table create; only guests need join.
  if (alreadySeated.value || privateState.value) {
    joined.value = true
    return
  }
  if (!publicState.value) {
    return
  }
  join()
  joined.value = true
}

watch([connected, publicState, privateState], () => {
  tryJoin()
})

const inviteUrl = computed(() => {
  const base = String(config.public.siteUrl).replace(/\/$/, '')
  return `${base}/play/${code.value}`
})

const isLobby = computed(() => publicState.value?.phase === 'Lobby')

const hostSeatId = computed(() => 0)

const isHost = computed(() => {
  if (!publicState.value || !user.value) {
    return false
  }
  const hostSeat = publicState.value.seats[hostSeatId.value]
  return hostSeat?.userId === user.value.id
})

const allSeatsFilled = computed(() =>
  publicState.value?.seats.every(seat => seat.userId !== null) ?? false,
)

const isMyTurn = computed(() => {
  if (!publicState.value || privateState.value === null) {
    return false
  }
  return publicState.value.currentSeat === privateState.value.seat
})

const isTaker = computed(() =>
  privateState.value !== null
  && publicState.value?.bid?.seat === privateState.value.seat,
)

const needsKingCall = computed(() =>
  publicState.value?.playerCount === 5
  && isTaker.value
  && !publicState.value.calledKing
  && (publicState.value.phase === 'DogEcarta' || publicState.value.phase === 'ReadyToPlay'),
)

const kingOptions = ['hearts-k', 'diamonds-k', 'clubs-k', 'spades-k'] as const

const discardSize = computed(() => {
  const count = publicState.value?.playerCount ?? 4
  return count === 5 ? 3 : 6
})

const canDiscard = computed(() =>
  publicState.value?.phase === 'DogEcarta'
  && isTaker.value
  && !!privateState.value
  && !needsKingCall.value,
)

const debugGfx = computed(() => String(route.query.debugGfx ?? '') === '1')

const selectedDiscard = shallowRef<CardId[]>([])

function toggleDiscard(card: CardId) {
  const next = [...selectedDiscard.value]
  const index = next.indexOf(card)
  if (index >= 0) {
    next.splice(index, 1)
  }
  else if (next.length < discardSize.value) {
    next.push(card)
  }
  selectedDiscard.value = next
}

watch(
  () => publicState.value?.phase,
  (phase) => {
    if (phase !== 'DogEcarta') {
      selectedDiscard.value = []
    }
  },
)

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value)
    toast.add({
      title: 'Lien copié',
      description: inviteUrl.value,
      color: 'success',
      icon: 'i-lucide-check',
    })
  } catch {
    toast.add({
      title: 'Copie impossible',
      description: 'Copiez le lien manuellement.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}
</script>

<template>
  <!-- Immersive table -->
  <div
    v-if="publicState && !isLobby"
    class="relative h-dvh w-full overflow-hidden bg-[#0a0f0c]"
  >
    <PlayTresTableScene
      class="absolute inset-0"
      :code="code"
      :public-state="publicState"
      :private-state="privateState"
      :debug-gfx="debugGfx"
      @play="sendIntent({ type: 'playCard', card: $event })"
    />

    <div class="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
      <div class="pointer-events-auto mx-auto w-full max-w-5xl space-y-2">
        <div class="flex items-start justify-between gap-3">
          <PlayScoreBanner
            :state="publicState"
            compact
            class="min-w-0 flex-1"
          />
          <UButton
            to="/play"
            color="neutral"
            variant="soft"
            icon="i-lucide-x"
            class="shrink-0 border border-white/10 bg-black/40 text-white backdrop-blur-md"
            aria-label="Quitter la table"
          />
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          :title="error"
        />
        <UAlert
          v-if="publicSyncDegraded"
          color="warning"
          variant="subtle"
          icon="i-lucide-wifi-off"
          title="Sync publique dégradée"
          description="La partie continue via le serveur de jeu."
        />
      </div>

      <div class="pointer-events-auto mx-auto w-full max-w-3xl space-y-3">
        <PlayBidPanel
          v-if="publicState.phase === 'Bidding' && isMyTurn"
          class="rounded-2xl border border-white/10 bg-black/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md"
          @bid="sendIntent({ type: 'bid', bid: $event })"
        />

        <div
          v-if="needsKingCall"
          class="rounded-2xl border border-white/10 bg-black/55 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md"
        >
          <p class="font-semibold text-amber-50">
            Appel au roi
          </p>
          <p class="mt-1 text-sm text-white/60">
            Choisissez le roi partenaire.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton
              v-for="king in kingOptions"
              :key="king"
              color="neutral"
              variant="soft"
              @click="sendIntent({ type: 'callKing', king })"
            >
              <PlayCardFace
                :card-id="king"
                size="sm"
              />
            </UButton>
          </div>
        </div>

        <div
          v-if="canDiscard"
          class="rounded-2xl border border-white/10 bg-black/60 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md"
        >
          <p class="font-semibold text-amber-50">
            Écart
          </p>
          <p class="mt-1 text-sm text-white/60">
            {{ selectedDiscard.length }} / {{ discardSize }} cartes
          </p>
          <div class="mt-3 flex max-h-40 flex-wrap justify-center gap-2 overflow-y-auto">
            <button
              v-for="card in privateState!.hand"
              :key="`discard-${card}`"
              type="button"
              class="rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              :class="selectedDiscard.includes(card)
                ? 'ring-2 ring-amber-300 -translate-y-1'
                : 'opacity-90 hover:-translate-y-0.5'"
              @click="toggleDiscard(card)"
            >
              <PlayCardFace :card-id="card" />
            </button>
          </div>
          <div class="mt-3 flex justify-end">
            <UButton
              color="primary"
              icon="i-lucide-check"
              :disabled="selectedDiscard.length !== discardSize"
              @click="sendIntent({ type: 'discard', cards: selectedDiscard })"
            >
              Valider l'écart
            </UButton>
          </div>
        </div>

        <div
          v-if="publicState.phase === 'Scoring'"
          class="rounded-2xl border border-white/10 bg-black/60 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md"
        >
          <p class="font-semibold text-amber-50">
            Marquage de la donne
          </p>
          <div
            v-if="publicState.lastDeltas"
            class="mt-3 grid gap-2 sm:grid-cols-2"
          >
            <div
              v-for="(delta, seat) in publicState.lastDeltas"
              :key="seat"
              class="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              <span class="text-white/60">{{ publicState.seats[Number(seat)]?.name || `Siège ${Number(seat) + 1}` }}</span>
              <span
                class="font-semibold tabular-nums"
                :class="Number(delta) >= 0 ? 'text-emerald-300' : 'text-rose-300'"
              >
                {{ Number(delta) > 0 ? `+${delta}` : delta }}
              </span>
            </div>
          </div>
          <div class="mt-3 flex justify-end">
            <UButton
              color="primary"
              icon="i-lucide-arrow-right"
              @click="sendIntent({ type: 'continue' })"
            >
              {{ publicState.matchShouldEnd ? 'Voir le résultat' : 'Donne suivante' }}
            </UButton>
          </div>
        </div>

        <div
          v-else-if="publicState.phase === 'MatchOver'"
          class="rounded-2xl border border-amber-200/20 bg-black/65 p-4 text-center text-white backdrop-blur-md"
        >
          <p class="text-lg font-semibold text-amber-50">
            Partie terminée
          </p>
          <UButton
            to="/play"
            class="mt-3"
            color="primary"
          >
            Nouvelle table
          </UButton>
        </div>
      </div>
    </div>
  </div>

  <!-- Lobby / loading -->
  <div
    v-else
    class="mx-auto min-h-dvh max-w-3xl px-4 py-8 sm:px-6"
  >
    <div class="mb-6">
      <p class="text-sm tracking-[0.2em] text-emerald-200/50 uppercase">
        Tarot
      </p>
      <h1 class="mt-1 font-serif text-3xl text-amber-50">
        Partie {{ code }}
      </h1>
      <p class="mt-1 text-sm text-white/50">
        {{ connected ? 'Connecté au serveur' : 'Connexion en cours…' }}
      </p>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-alert-circle"
      :title="error"
      class="mb-4"
    />

    <UAlert
      v-if="publicSyncDegraded"
      color="warning"
      variant="subtle"
      icon="i-lucide-wifi-off"
      title="Sync publique dégradée"
      description="Le serveur de synchro Yjs est indisponible. La partie continue via le serveur de jeu."
      class="mb-4"
    />

    <div
      v-if="!publicState"
      class="space-y-3"
    >
      <USkeleton class="h-10 rounded-lg" />
      <USkeleton class="h-40 rounded-xl" />
    </div>

    <template v-else>
      <UCard class="mb-4 border-white/10 bg-white/5">
        <template #header>
          <p class="font-semibold text-amber-50">
            Code de la partie
          </p>
        </template>

        <div class="flex flex-wrap items-center gap-3">
          <code class="rounded-lg bg-black/40 px-3 py-2 text-lg font-semibold tracking-widest text-amber-50">
            {{ code }}
          </code>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-copy"
            @click="copyInviteLink"
          >
            Copier le lien d'invitation
          </UButton>
        </div>
        <p class="mt-3 break-all text-sm text-white/50">
          {{ inviteUrl }}
        </p>
      </UCard>

      <UCard class="border-white/10 bg-white/5">
        <template #header>
          <p class="font-semibold text-amber-50">
            Joueurs
          </p>
          <p class="text-sm text-white/50">
            {{ publicState.seats.filter(seat => seat.userId).length }} / {{ publicState.playerCount }}
          </p>
        </template>

        <PlaySeatList
          :seats="publicState.seats"
          :host-seat-id="hostSeatId"
          :show-host-controls="isHost"
          @remove-bot="sendIntent({ type: 'removeBot', seat: $event })"
        />

        <div
          v-if="isHost"
          class="mt-4 flex flex-wrap gap-2"
        >
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-bot"
            @click="sendIntent({ type: 'addBot' })"
          >
            Ajouter un bot
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-play"
            :disabled="!allSeatsFilled"
            @click="sendIntent({ type: 'start' })"
          >
            Lancer
          </UButton>
        </div>
      </UCard>
    </template>
  </div>
</template>
