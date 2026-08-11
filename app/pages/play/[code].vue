<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'

definePageMeta({
  middleware: 'auth',
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

const discardSize = computed(() => {
  const count = publicState.value?.playerCount ?? 4
  return count === 5 ? 3 : 6
})

const selectedDiscard = shallowRef<CardId[]>([])

watch(
  () => publicState.value?.phase,
  (phase) => {
    if (phase !== 'DogEcarta') {
      selectedDiscard.value = []
    }
  },
)

function toggleDiscard(card: CardId) {
  const index = selectedDiscard.value.indexOf(card)
  if (index >= 0) {
    selectedDiscard.value = selectedDiscard.value.filter(item => item !== card)
    return
  }
  if (selectedDiscard.value.length >= discardSize.value) {
    return
  }
  selectedDiscard.value = [...selectedDiscard.value, card]
}

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
  <UPage>
    <UPageHeader
      :title="`Partie ${code}`"
      :description="connected ? 'Connecté au serveur' : 'Connexion en cours…'"
      :ui="{
        container: 'gap-4 py-6 sm:py-8',
      }"
    />

    <UPageSection :ui="{ container: 'max-w-4xl pt-0 pb-8' }">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="error"
        class="mb-4"
      />

      <div
        v-if="!publicState"
        class="space-y-3"
      >
        <USkeleton class="h-10 rounded-lg" />
        <USkeleton class="h-40 rounded-xl" />
      </div>

      <template v-else-if="isLobby">
        <UCard class="mb-4">
          <template #header>
            <p class="font-semibold text-highlighted">
              Code de la partie
            </p>
          </template>

          <div class="flex flex-wrap items-center gap-3">
            <code class="rounded-lg bg-muted px-3 py-2 text-lg font-semibold tracking-widest">
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
          <p class="mt-3 break-all text-sm text-muted">
            {{ inviteUrl }}
          </p>
        </UCard>

        <UCard class="mb-4">
          <template #header>
            <p class="font-semibold text-highlighted">
              Joueurs
            </p>
            <p class="text-sm text-muted">
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

      <template v-else>
        <PlayScoreBanner
          :state="publicState"
          class="mb-4"
        />

        <PlayTrickArea
          :trick="publicState.trick"
          :seats="publicState.seats"
          :current-seat="publicState.currentSeat"
          class="mb-4"
        />

        <UCard
          v-if="publicState.chienRevealed?.length"
          class="mb-4"
        >
          <template #header>
            <p class="font-semibold text-highlighted">
              Chien
            </p>
          </template>
          <div class="flex flex-wrap gap-2">
            <PlayCardFace
              v-for="card in publicState.chienRevealed"
              :key="card"
              :card-id="card"
              size="sm"
            />
          </div>
        </UCard>

        <PlayBidPanel
          v-if="publicState.phase === 'Bidding' && isMyTurn"
          class="mb-4"
          @bid="sendIntent({ type: 'bid', bid: $event })"
        />

        <UCard
          v-if="publicState.phase === 'DogEcarta' && isTaker && privateState"
          class="mb-4"
        >
          <template #header>
            <p class="font-semibold text-highlighted">
              Écart
            </p>
            <p class="text-sm text-muted">
              Sélectionnez {{ discardSize }} cartes à écarter ({{ selectedDiscard.length }} / {{ discardSize }}).
            </p>
          </template>

          <div class="flex flex-wrap justify-center gap-2">
            <button
              v-for="card in privateState.hand"
              :key="`discard-${card}`"
              type="button"
              class="rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :class="selectedDiscard.includes(card)
                ? 'ring-2 ring-primary -translate-y-1'
                : 'opacity-90 hover:-translate-y-0.5'"
              @click="toggleDiscard(card)"
            >
              <PlayCardFace :card-id="card" />
            </button>
          </div>

          <div class="mt-4 flex justify-end">
            <UButton
              color="primary"
              icon="i-lucide-check"
              :disabled="selectedDiscard.length !== discardSize"
              @click="sendIntent({ type: 'discard', cards: selectedDiscard })"
            >
              Valider l'écart
            </UButton>
          </div>
        </UCard>

        <UCard
          v-if="privateState?.hand.length && !(publicState.phase === 'DogEcarta' && isTaker)"
          class="mb-4"
        >
          <template #header>
            <p class="font-semibold text-highlighted">
              Votre main
            </p>
            <p
              v-if="privateState.seat === publicState.currentSeat"
              class="text-sm text-muted"
            >
              À vous de jouer
            </p>
          </template>

          <PlayHandCards
            :cards="privateState.hand"
            :legal-moves="privateState.legalMoves"
            @play="sendIntent({ type: 'playCard', card: $event })"
          />
        </UCard>

        <UAlert
          v-else-if="publicState.phase === 'Dealing'"
          color="neutral"
          variant="subtle"
          icon="i-lucide-shuffle"
          title="Distribution en cours"
        />

        <UAlert
          v-else-if="publicState.phase === 'MatchOver'"
          color="success"
          variant="subtle"
          icon="i-lucide-trophy"
          title="Partie terminée"
        />
      </template>
    </UPageSection>
  </UPage>
</template>
