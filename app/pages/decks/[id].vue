<script setup lang="ts">
import type { DeckCard, DeckDetails, DeckPhoto } from '~/types/deck'
import { patchDeckSettings, patchDeckWithCard } from '~/utils/deckState'

definePageMeta({
  middleware: 'auth'
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const deckId = computed(() => String(route.params.id))
const requestFetch = useRequestFetch()
const isDeletingDeck = shallowRef(false)

const { data, pending, refresh } = await useAsyncData(
  () => `deck-${deckId.value}`,
  () => requestFetch<DeckDetails>(`/api/decks/${deckId.value}`)
)

const readyPercent = computed(() => {
  if (!data.value?.deck.cardCount) {
    return 0
  }

  return Math.round((data.value.deck.readyCardCount / data.value.deck.cardCount) * 100)
})

const deckTypeLabels: Record<string, string> = {
  classic52: 'Jeu classique (52 cartes)',
  tarot56: 'Tarot enseignes (56 cartes)',
  tarot78: 'Tarot complet (78 cartes)'
}

const deckStatusLabels: Record<string, string> = {
  draft: 'En préparation',
  queued: 'En file',
  generating: 'Génération en cours',
  ready: 'Terminé',
  failed: 'À reprendre'
}

const deckStatusColors = {
  draft: 'neutral',
  queued: 'info',
  generating: 'warning',
  ready: 'success',
  failed: 'error'
} as const

useSeoMeta({
  title: () => data.value?.deck.title || 'Deck'
})

async function handlePhotoUploaded(_photos: DeckPhoto[]) {
  await refresh()
}

function handleCardUpdated(card: DeckCard) {
  if (!data.value) {
    return
  }

  data.value = patchDeckWithCard(data.value, card)
}

function handleDeckSettingsUpdated(settings: Partial<DeckDetails['deck']['settings']>) {
  if (!data.value) {
    return
  }

  data.value = patchDeckSettings(data.value, settings)
}

async function deleteDeck() {
  if (!data.value?.deck || isDeletingDeck.value) {
    return
  }

  const confirmed = window.confirm(`Supprimer le deck "${data.value.deck.title}" ?`)

  if (!confirmed) {
    return
  }

  isDeletingDeck.value = true

  try {
    await $fetch(`/api/decks/${data.value.deck.id}`, {
      method: 'DELETE'
    })
    toast.add({
      title: 'Deck supprimé',
      description: 'Le deck a été retiré de votre dashboard.',
      color: 'success',
      icon: 'i-lucide-check'
    })
    await router.push('/dashboard')
  } catch (error) {
    toast.add({
      title: 'Suppression impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    isDeletingDeck.value = false
  }
}
</script>

<template>
  <UPage>
    <UPageHeader
      :title="data?.deck.title || 'Deck'"
      :description="data?.deck.description || 'Ajoutez vos photos, assignez les personnes, puis créez les visuels.'"
      :links="[
        { label: 'Retour', icon: 'i-lucide-arrow-left', to: '/dashboard', color: 'neutral', variant: 'subtle' }
      ]"
      :ui="{
        root: 'border-b border-default',
        container: 'gap-4 py-6 sm:py-8',
        links: 'flex-wrap'
      }"
    />

    <UPageSection :ui="{ container: 'pt-0 pb-8' }">
      <div
        v-if="pending"
        class="space-y-4"
      >
        <USkeleton class="h-28 rounded-xl" />
        <USkeleton class="h-64 rounded-xl" />
      </div>

      <div
        v-else-if="data"
        class="space-y-6 sm:space-y-8"
      >
        <div class="grid gap-3 sm:grid-cols-[1fr_14rem] md:grid-cols-[1fr_18rem]">
          <div class="rounded-xl border border-default bg-default p-4">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm text-muted">
                  Cartes prêtes
                </p>
                <p class="text-2xl font-bold text-highlighted">
                  {{ data.deck.readyCardCount }} / {{ data.deck.cardCount }}
                </p>
              </div>
              <UBadge
                :color="deckStatusColors[data.deck.status]"
                variant="subtle"
                class="shrink-0"
              >
                {{ deckStatusLabels[data.deck.status] || data.deck.status }}
              </UBadge>
            </div>
            <UProgress
              class="mt-4"
              :model-value="readyPercent"
            />
          </div>

          <div class="rounded-xl border border-default bg-default p-4">
            <p class="text-sm text-muted">
              Format
            </p>
            <p class="mt-1 font-semibold text-highlighted">
              {{ deckTypeLabels[data.deck.type] || data.deck.type }}
            </p>
            <p class="mt-3 text-sm text-muted">
              {{ data.deck.settings.allowPhotoReuse ? 'Une personne peut illustrer plusieurs cartes' : 'Chaque personne n’illustre qu’une carte' }}
            </p>
          </div>
        </div>

        <DeckPhotoUploader
          :deck-id="data.deck.id"
          :persons="data.persons"
          @uploaded="handlePhotoUploaded"
        />

        <DeckPhotoStrip
          :deck-id="data.deck.id"
          :persons="data.persons"
          @renamed="refresh()"
        />

        <DeckPhotoAssigner
          :deck-id="data.deck.id"
          :cards="data.cards"
          :persons="data.persons"
          @assigned="refresh()"
        />

        <DeckGenerationPanel
          :deck-id="data.deck.id"
          :visual-style="data.deck.settings.visualStyle"
          :role-prompts="data.deck.settings.rolePrompts"
          :suit-prompts="data.deck.settings.suitPrompts"
          :cards="data.cards"
          @card-updated="handleCardUpdated"
          @deck-settings-updated="handleDeckSettingsUpdated"
        />

        <div class="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <UButton
            color="neutral"
            variant="subtle"
            class="w-full justify-center sm:w-auto"
            icon="i-lucide-refresh-cw"
            @click="refresh()"
          >
            Rafraîchir
          </UButton>
          <UButton
            color="error"
            variant="subtle"
            class="w-full justify-center sm:w-auto"
            icon="i-lucide-trash-2"
            :loading="isDeletingDeck"
            @click="deleteDeck"
          >
            Supprimer le deck
          </UButton>
        </div>

        <DeckCardGrid
          :deck-id="data.deck.id"
          :cards="data.cards"
          :persons="data.persons"
          @card-updated="handleCardUpdated"
        />
      </div>
    </UPageSection>
  </UPage>
</template>
