<script setup lang="ts">
import type { PublicGameView } from '~~/shared/tarot'

const props = defineProps<{
  code: string
  state: PublicGameView | null
  connected: boolean
  isHost: boolean
  inviteUrl: string
}>()

const emit = defineEmits<{
  addBot: []
  removeBot: [seat: number]
  start: []
}>()

const toast = useToast()
const { copy, copied } = useClipboard({ copiedDuring: 2000 })
const canShare = computed(() => import.meta.client && typeof navigator.share === 'function')

const seated = computed(() => props.state?.seats.filter(seat => seat.userId || seat.controlledBy === 'bot').length ?? 0)
const missing = computed(() => (props.state?.playerCount ?? 0) - seated.value)
const ready = computed(() => props.state?.seats.every(seat => seat.userId !== null) ?? false)

const endLabel = computed(() => {
  if (!props.state) {
    return ''
  }
  return props.state.endMode === 'threshold'
    ? `Partie en ${props.state.endValue} points`
    : `Partie en ${props.state.endValue} donne${props.state.endValue > 1 ? 's' : ''}`
})

function seatPosition(index: number, total: number) {
  const angle = Math.PI / 2 + (index * 2 * Math.PI) / total
  return {
    left: `${50 + 42 * Math.cos(angle)}%`,
    top: `${50 + 38 * Math.sin(angle)}%`
  }
}

async function copyLink() {
  await copy(props.inviteUrl)
  toast.add({ title: 'Lien copié', description: 'Envoyez-le aux autres joueurs.', color: 'success', icon: 'i-lucide-link' })
}

async function share() {
  try {
    await navigator.share({ title: 'Une partie de tarot ?', text: `Rejoins ma table (code ${props.code})`, url: props.inviteUrl })
  } catch {
    // Share sheet dismissed.
  }
}
</script>

<template>
  <div class="relative min-h-dvh overflow-hidden px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_45%,var(--color-violet-950),transparent_80%)]" />

    <div class="relative mx-auto flex max-w-3xl flex-col gap-8">
      <header class="flex items-center justify-between">
        <UButton
          to="/play"
          icon="i-lucide-arrow-left"
          label="Quitter"
          color="neutral"
          variant="ghost"
        />
        <UBadge
          :label="connected ? 'Connecté' : 'Connexion…'"
          :color="connected ? 'success' : 'warning'"
          variant="subtle"
          :icon="connected ? 'i-lucide-wifi' : 'i-lucide-loader-circle'"
          :ui="{ leadingIcon: connected ? '' : 'animate-spin' }"
        />
      </header>

      <div class="text-center">
        <p class="text-sm text-muted">
          Salle d’attente · {{ endLabel }}
        </p>
        <h1 class="mt-2 font-display text-5xl text-highlighted sm:text-6xl">
          Table {{ code }}
        </h1>
      </div>

      <template v-if="state">
        <!-- Table -->
        <div class="relative mx-auto aspect-[16/10] w-full max-w-xl">
          <div class="absolute inset-[16%_14%] rounded-[50%] bg-emerald-900 shadow-[inset_0_0_80px_rgba(0,0,0,0.65),0_30px_60px_-20px_rgba(0,0,0,0.8)] ring-[10px] ring-amber-950" />
          <div class="absolute inset-0 grid place-items-center">
            <p
              class="rounded-full bg-black/30 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur"
              aria-live="polite"
            >
              <template v-if="ready">
                Tout le monde est là
              </template>
              <template v-else>
                {{ missing }} place{{ missing > 1 ? 's' : '' }} libre{{ missing > 1 ? 's' : '' }}
              </template>
            </p>
          </div>

          <div
            v-for="(seat, index) in state.seats"
            :key="seat.seatId"
            class="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 text-center"
            :style="seatPosition(index, state.seats.length)"
          >
            <div class="relative">
              <UAvatar
                v-if="seat.userId || seat.controlledBy === 'bot'"
                :alt="seat.name"
                :icon="seat.controlledBy === 'bot' ? 'i-lucide-bot' : undefined"
                size="xl"
                :class="seat.controlledBy === 'bot' ? 'bg-sky-950 text-sky-300 ring-2 ring-sky-400/40' : 'bg-primary/20 text-primary ring-2 ring-primary/50'"
                :chip="seat.controlledBy === 'human' ? { color: seat.connected ? 'success' : 'neutral', position: 'bottom-right' } : undefined"
              />
              <div
                v-else
                class="grid size-12 place-items-center rounded-full border-2 border-dashed border-white/25 text-white/40"
              >
                <UIcon
                  name="i-lucide-user-round-plus"
                  class="size-5"
                />
              </div>
              <UButton
                v-if="isHost && seat.controlledBy === 'bot'"
                icon="i-lucide-x"
                size="xs"
                color="neutral"
                variant="solid"
                class="absolute -top-1.5 -right-1.5 rounded-full p-0.5"
                :aria-label="`Retirer ${seat.name}`"
                @click="emit('removeBot', seat.seatId)"
              />
            </div>
            <p class="w-full truncate text-xs font-medium text-default">
              {{ seat.userId || seat.controlledBy === 'bot' ? seat.name : 'Libre' }}
              <span
                v-if="seat.seatId === 0"
                class="text-dimmed"
              > · hôte</span>
            </p>
          </div>
        </div>

        <!-- Invite -->
        <div class="mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-2xl bg-elevated/60 p-4 ring ring-default backdrop-blur">
          <p class="text-sm text-muted">
            Invitez les autres joueurs
          </p>
          <div class="flex w-full gap-2">
            <UInput
              :model-value="inviteUrl"
              readonly
              class="flex-1"
              :ui="{ base: 'font-mono text-xs' }"
              aria-label="Lien d’invitation"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <UButton
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copied ? 'Copié' : 'Copier'"
              color="neutral"
              variant="subtle"
              @click="copyLink"
            />
            <UButton
              v-if="canShare"
              icon="i-lucide-share"
              color="neutral"
              variant="subtle"
              square
              aria-label="Partager"
              @click="share"
            />
          </div>
        </div>

        <!-- Host actions -->
        <div
          v-if="isHost"
          class="flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <UButton
            label="Ajouter un bot"
            icon="i-lucide-bot"
            color="neutral"
            variant="subtle"
            size="lg"
            :disabled="ready"
            @click="emit('addBot')"
          />
          <UButton
            label="Lancer la partie"
            icon="i-lucide-play"
            size="lg"
            :disabled="!ready"
            @click="emit('start')"
          />
        </div>
        <p
          v-else
          class="text-center text-sm text-muted"
        >
          L’hôte lancera la partie dès que la table sera complète.
        </p>
      </template>

      <div
        v-else
        class="mx-auto w-full max-w-xl space-y-4"
      >
        <USkeleton class="aspect-[16/10] w-full rounded-[50%]" />
        <USkeleton class="mx-auto h-16 w-full max-w-md rounded-2xl" />
      </div>
    </div>
  </div>
</template>
