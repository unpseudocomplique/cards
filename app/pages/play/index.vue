<script setup lang="ts">
import type { EndMode, PlayerCount } from '~~/shared/tarot'
import type { DeckSummary } from '~/types/deck'

definePageMeta({
  middleware: 'auth',
})

useSeoMeta({
  title: 'Nouvelle partie de tarot',
})

const toast = useToast()
const isSubmitting = shallowRef(false)

const form = reactive({
  playerCount: 4 as PlayerCount,
  endMode: 'threshold' as EndMode,
  endValue: 1000,
  deckId: '' as string,
})

const { data: decksData, status: decksStatus } = await useFetch<DeckSummary[]>('/api/decks')

const tarotDecks = computed(() =>
  (decksData.value ?? []).filter(deck => deck.type === 'tarot78'),
)

const deckOptions = computed(() =>
  tarotDecks.value.map(deck => ({
    label: `${deck.title} (${deck.readyCardCount}/${deck.cardCount})`,
    value: deck.id,
  })),
)

watch(
  tarotDecks,
  (list) => {
    if (!form.deckId && list[0]) {
      form.deckId = list[0].id
    }
  },
  { immediate: true },
)

const playerCountOptions = [
  { label: '3 joueurs', value: 3 },
  { label: '4 joueurs', value: 4 },
  { label: '5 joueurs', value: 5 },
]

const endModeOptions = [
  { label: 'Seuil de points', value: 'threshold' },
  { label: 'Nombre de donnes', value: 'deals' },
]

async function createGame() {
  if (!form.deckId) {
    toast.add({
      title: 'Deck requis',
      description: 'Choisissez un deck tarot78 pour afficher les faces 3D.',
      color: 'warning',
      icon: 'i-lucide-alert-circle',
    })
    return
  }

  isSubmitting.value = true

  try {
    const result = await $fetch<{ code: string }>('/api/game/create', {
      method: 'POST',
      body: {
        playerCount: form.playerCount,
        endMode: form.endMode,
        endValue: form.endValue,
        deckId: form.deckId,
      },
    })

    await navigateTo(`/play/${result.code}`)
  } catch (error) {
    toast.add({
      title: 'Création impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <header class="mb-8">
      <p class="text-xs tracking-[0.2em] text-primary uppercase">
        Table privée
      </p>
      <h1 class="mt-2 font-serif text-3xl tracking-tight text-highlighted sm:text-4xl">
        Jouer au tarot
      </h1>
      <p class="mt-2 max-w-[46ch] text-pretty text-muted">
        Ouvrez une table 3D avec votre deck tarot 78 cartes. Sur téléphone, la partie se joue en paysage.
      </p>
    </header>

    <UAlert
      v-if="decksStatus === 'success' && tarotDecks.length === 0"
      class="mb-6"
      color="warning"
      variant="subtle"
      icon="i-lucide-layers"
      title="Aucun deck tarot 78"
      description="Créez d’abord un deck tarot à 78 cartes, puis revenez ouvrir une table."
    />

    <form
      class="max-w-xl space-y-6"
      @submit.prevent="createGame"
    >
        <UFormField
          label="Deck (faces 3D)"
          required
        >
          <USelect
            v-model="form.deckId"
            :items="deckOptions"
            value-key="value"
            label-key="label"
            class="w-full"
            :disabled="deckOptions.length === 0"
            placeholder="Sélectionnez un deck tarot78"
          />
        </UFormField>

        <UFormField
          label="Nombre de joueurs"
          required
        >
          <USelect
            v-model="form.playerCount"
            :items="playerCountOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Fin de partie"
          required
        >
          <USelect
            v-model="form.endMode"
            :items="endModeOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="form.endMode === 'threshold' ? 'Seuil de points' : 'Nombre de donnes'"
          required
        >
          <UInput
            v-model.number="form.endValue"
            type="number"
            min="1"
            class="w-full"
            required
          />
        </UFormField>

        <div class="flex justify-stretch sm:justify-end">
          <UButton
            type="submit"
            class="w-full justify-center sm:w-auto"
            icon="i-lucide-spade"
            :loading="isSubmitting"
            :disabled="!form.deckId"
          >
            Ouvrir la table
          </UButton>
        </div>
      </form>
  </div>
</template>
