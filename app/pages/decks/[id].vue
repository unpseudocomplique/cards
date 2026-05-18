<script setup lang="ts">
import type { DeckDetails, DeckPhoto } from '~/types/deck'

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

useSeoMeta({
  title: () => data.value?.deck.title || 'Deck'
})

async function handlePhotoUploaded(_photos: DeckPhoto[]) {
  await refresh()
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
      :description="data?.deck.description || 'Importez les photos, préparez la génération et suivez les cartes.'"
      :links="[
        { label: 'Retour', icon: 'i-lucide-arrow-left', to: '/dashboard', color: 'neutral', variant: 'subtle' }
      ]"
    />

    <UPageSection :ui="{ container: 'pt-0' }">
      <div
        v-if="pending"
        class="space-y-4"
      >
        <USkeleton class="h-28 rounded-lg" />
        <USkeleton class="h-64 rounded-lg" />
      </div>

      <div
        v-else-if="data"
        class="space-y-8"
      >
        <div class="grid gap-3 md:grid-cols-[1fr_18rem]">
          <div class="rounded-lg border border-default bg-default p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm text-muted">
                  Progression
                </p>
                <p class="text-2xl font-bold text-highlighted">
                  {{ data.deck.readyCardCount }} / {{ data.deck.cardCount }}
                </p>
              </div>
              <UBadge
                color="neutral"
                variant="subtle"
              >
                {{ data.deck.status }}
              </UBadge>
            </div>
            <UProgress
              class="mt-4"
              :model-value="readyPercent"
            />
          </div>

          <div class="rounded-lg border border-default bg-default p-4">
            <p class="text-sm text-muted">
              Type
            </p>
            <p class="mt-1 font-semibold text-highlighted">
              {{ data.deck.type }}
            </p>
            <p class="mt-3 text-sm text-muted">
              {{ data.deck.settings.allowPhotoReuse ? 'Réutilisation des photos autorisée' : 'Chaque photo ne doit être utilisée qu une fois' }}
            </p>
          </div>
        </div>

        <DeckPhotoUploader
          :deck-id="data.deck.id"
          @uploaded="handlePhotoUploaded"
        />

        <DeckPhotoStrip
          :deck-id="data.deck.id"
          :photos="data.photos"
          @renamed="refresh()"
        />

        <DeckPhotoAssigner
          :deck-id="data.deck.id"
          :cards="data.cards"
          :photos="data.photos"
          @assigned="refresh()"
        />

        <DeckGenerationPanel
          :deck-id="data.deck.id"
          :visual-style="data.deck.settings.visualStyle"
          :cards="data.cards"
          @updated="refresh()"
        />

        <div class="flex flex-wrap items-center gap-2">
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-refresh-cw"
            @click="refresh()"
          >
            Rafraîchir
          </UButton>
          <UButton
            color="error"
            variant="subtle"
            icon="i-lucide-trash-2"
            :loading="isDeletingDeck"
            @click="deleteDeck"
          >
            Supprimer le deck
          </UButton>
        </div>

        <DeckCardGrid :cards="data.cards" />
      </div>
    </UPageSection>
  </UPage>
</template>
