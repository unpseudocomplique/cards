<script setup lang="ts">
import type { DeckCard } from '~/types/deck'

type RoleValue = 'number' | 'ace' | 'jack' | 'knight' | 'queen' | 'king' | 'trump' | 'excuse'

type GenerateJob = {
  totalCards: number
}

const props = defineProps<{
  deckId: string
  visualStyle: string
  cards: DeckCard[]
}>()

const emit = defineEmits<{
  updated: []
}>()

const toast = useToast()
const globalPromptDraft = shallowRef(props.visualStyle)
const selectedTestCardId = shallowRef(props.cards[0]?.id || '')
const selectedPromptCardId = shallowRef(props.cards[0]?.id || '')
const cardPromptDraft = shallowRef('')
const selectedCardIds = shallowRef<string[]>([])
const selectedRoleFilter = shallowRef<'all' | RoleValue>('all')
const isSavingGlobalPrompt = shallowRef(false)
const isSavingCardPrompt = shallowRef(false)
const isTestingCard = shallowRef(false)
const isQueueing = shallowRef(false)

const roleOptions: Array<{ value: RoleValue, label: string }> = [
  { value: 'queen', label: 'Dames' },
  { value: 'king', label: 'Rois' },
  { value: 'jack', label: 'Valets' },
  { value: 'knight', label: 'Cavaliers' },
  { value: 'trump', label: 'Atouts' },
  { value: 'excuse', label: 'Excuse' },
  { value: 'ace', label: 'As' },
  { value: 'number', label: 'Cartes numérales' }
]

const roleFilterOptions = computed(() => [
  { value: 'all' as const, label: 'Toutes les cartes' },
  ...roleOptions
])

const cardOptions = computed(() => props.cards.map(card => ({
  id: card.id,
  label: `${card.metadata.label} (${card.status})`
})))

const visibleCards = computed(() => {
  if (selectedRoleFilter.value === 'all') {
    return props.cards
  }

  return props.cards.filter(card => card.metadata.role === selectedRoleFilter.value)
})

const selectedPromptCard = computed(() => props.cards.find(card => card.id === selectedPromptCardId.value) || null)
const selectedTestCard = computed(() => props.cards.find(card => card.id === selectedTestCardId.value) || null)
const selectedCount = computed(() => selectedCardIds.value.length)

watch(() => props.visualStyle, (visualStyle) => {
  globalPromptDraft.value = visualStyle
})

watch(() => props.cards, (cards) => {
  if (!cards.some(card => card.id === selectedTestCardId.value)) {
    selectedTestCardId.value = cards[0]?.id || ''
  }

  if (!cards.some(card => card.id === selectedPromptCardId.value)) {
    selectedPromptCardId.value = cards[0]?.id || ''
  }

  selectedCardIds.value = selectedCardIds.value.filter(cardId => cards.some(card => card.id === cardId))
}, { immediate: true })

watch(selectedPromptCard, (card) => {
  cardPromptDraft.value = card?.prompt || ''
}, { immediate: true })

function isSelected(cardId: string) {
  return selectedCardIds.value.includes(cardId)
}

function toggleCard(cardId: string) {
  selectedCardIds.value = isSelected(cardId)
    ? selectedCardIds.value.filter(selectedCardId => selectedCardId !== cardId)
    : [...selectedCardIds.value, cardId]
}

function selectVisibleCards() {
  const nextIds = new Set(selectedCardIds.value)

  for (const card of visibleCards.value) {
    nextIds.add(card.id)
  }

  selectedCardIds.value = [...nextIds]
}

function clearSelectedCards() {
  selectedCardIds.value = []
}

async function saveGlobalPrompt() {
  const visualStyle = globalPromptDraft.value.trim()

  if (!visualStyle) {
    toast.add({
      title: 'Prompt global requis',
      description: 'Ajoutez une direction visuelle avant de sauvegarder.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  isSavingGlobalPrompt.value = true

  try {
    await $fetch(`/api/decks/${props.deckId}/prompt`, {
      method: 'PATCH',
      body: { visualStyle }
    })

    toast.add({
      title: 'Prompt global sauvegardé',
      color: 'success',
      icon: 'i-lucide-check'
    })
    emit('updated')
  } catch (error) {
    toast.add({
      title: 'Sauvegarde impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    isSavingGlobalPrompt.value = false
  }
}

async function saveCardPrompt(clear = false) {
  if (!selectedPromptCard.value) {
    return
  }

  isSavingCardPrompt.value = true

  try {
    await $fetch(`/api/decks/${props.deckId}/cards/${selectedPromptCard.value.id}/prompt`, {
      method: 'PATCH',
      body: { prompt: clear ? null : cardPromptDraft.value.trim() || null }
    })

    toast.add({
      title: clear ? 'Prompt supprimé' : 'Prompt de carte sauvegardé',
      color: 'success',
      icon: 'i-lucide-check'
    })
    emit('updated')
  } catch (error) {
    toast.add({
      title: 'Sauvegarde impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    isSavingCardPrompt.value = false
  }
}

async function testSelectedCard() {
  if (!selectedTestCard.value) {
    return
  }

  if (!selectedTestCard.value.sourcePhotoId) {
    toast.add({
      title: 'Photo manquante',
      description: 'Affectez une photo à cette carte avant de lancer un test.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  isTestingCard.value = true

  try {
    await $fetch(`/api/decks/${props.deckId}/cards/${selectedTestCard.value.id}/generate`, {
      method: 'POST'
    })

    toast.add({
      title: 'Carte générée',
      description: selectedTestCard.value.metadata.label,
      color: 'success',
      icon: 'i-lucide-check'
    })
    emit('updated')
  } catch (error) {
    toast.add({
      title: 'Test impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
    emit('updated')
  } finally {
    isTestingCard.value = false
  }
}

async function queuePendingCards() {
  await queueGeneration({ scope: 'pending' })
}

async function queueSelectedCards() {
  if (!selectedCardIds.value.length) {
    toast.add({
      title: 'Aucune carte sélectionnée',
      description: 'Sélectionnez au moins une carte à relancer.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  await queueGeneration({ scope: 'cards', cardIds: selectedCardIds.value })
}

async function queueGeneration(body: { scope: 'pending' } | { scope: 'cards', cardIds: string[] }) {
  isQueueing.value = true

  try {
    const job = await $fetch<GenerateJob>(`/api/decks/${props.deckId}/generate`, {
      method: 'POST',
      body
    })

    toast.add({
      title: 'Génération préparée',
      description: `${job.totalCards} carte(s) en file.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
    emit('updated')
  } catch (error) {
    toast.add({
      title: 'Démarrage impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    isQueueing.value = false
  }
}
</script>

<template>
  <section class="space-y-5 rounded-lg border border-default bg-default p-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="font-semibold text-highlighted">
          Prompts et génération
        </h2>
        <p class="mt-1 text-sm text-muted">
          Ajustez la direction IA, testez une carte, puis relancez seulement les cartes voulues.
        </p>
      </div>
      <UBadge
        color="neutral"
        variant="subtle"
      >
        {{ selectedCount }} sélectionnée(s)
      </UBadge>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="space-y-3 rounded-lg border border-default p-3">
        <UFormField label="Prompt global">
          <textarea
            v-model="globalPromptDraft"
            class="min-h-32 w-full resize-y rounded-md border border-default bg-default px-3 py-2 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
            maxlength="1200"
          />
        </UFormField>
        <UButton
          icon="i-lucide-save"
          :loading="isSavingGlobalPrompt"
          @click="saveGlobalPrompt"
        >
          Sauvegarder
        </UButton>
      </div>

      <div class="space-y-3 rounded-lg border border-default p-3">
        <UFormField label="Test avec une carte">
          <select
            v-model="selectedTestCardId"
            class="h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
          >
            <option
              v-for="card in cardOptions"
              :key="card.id"
              :value="card.id"
            >
              {{ card.label }}
            </option>
          </select>
        </UFormField>
        <div class="flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-sparkles"
            :loading="isTestingCard"
            @click="testSelectedCard"
          >
            Générer le test
          </UButton>
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-list-plus"
            :loading="isQueueing"
            @click="queuePendingCards"
          >
            Préparer les cartes en attente
          </UButton>
        </div>
        <UAlert
          v-if="selectedTestCard && !selectedTestCard.sourcePhotoId"
          color="warning"
          variant="subtle"
          icon="i-lucide-image-off"
          title="Photo manquante"
          description="Cette carte doit avoir une photo affectée avant un test immédiat."
        />
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div class="space-y-3 rounded-lg border border-default p-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="font-medium text-highlighted">
            Relancer des cartes
          </p>
          <select
            v-model="selectedRoleFilter"
            class="h-10 rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
          >
            <option
              v-for="role in roleFilterOptions"
              :key="role.value"
              :value="role.value"
            >
              {{ role.label }}
            </option>
          </select>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="subtle"
            size="sm"
            icon="i-lucide-check-square"
            @click="selectVisibleCards"
          >
            Sélectionner
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-square"
            @click="clearSelectedCards"
          >
            Vider
          </UButton>
          <UButton
            size="sm"
            icon="i-lucide-refresh-cw"
            :loading="isQueueing"
            @click="queueSelectedCards"
          >
            Relancer la sélection
          </UButton>
        </div>

        <div class="max-h-96 divide-y divide-default overflow-auto rounded-lg border border-default">
          <label
            v-for="card in visibleCards"
            :key="card.id"
            class="flex cursor-pointer items-center gap-3 p-3 text-sm"
          >
            <input
              type="checkbox"
              class="size-4 accent-primary"
              :checked="isSelected(card.id)"
              @change="toggleCard(card.id)"
            >
            <span class="min-w-0 flex-1 truncate text-highlighted">
              {{ card.metadata.label }}
            </span>
            <UBadge
              color="neutral"
              variant="subtle"
            >
              {{ card.status }}
            </UBadge>
          </label>
        </div>
      </div>

      <div class="space-y-3 rounded-lg border border-default p-3">
        <UFormField label="Prompt spécifique">
          <select
            v-model="selectedPromptCardId"
            class="mb-3 h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
          >
            <option
              v-for="card in cardOptions"
              :key="card.id"
              :value="card.id"
            >
              {{ card.label }}
            </option>
          </select>
          <textarea
            v-model="cardPromptDraft"
            class="min-h-40 w-full resize-y rounded-md border border-default bg-default px-3 py-2 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
            maxlength="1200"
            placeholder="Détails propres à cette carte"
          />
        </UFormField>
        <div class="flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-save"
            :loading="isSavingCardPrompt"
            @click="saveCardPrompt(false)"
          >
            Sauvegarder
          </UButton>
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-eraser"
            :loading="isSavingCardPrompt"
            @click="saveCardPrompt(true)"
          >
            Effacer
          </UButton>
        </div>
      </div>
    </div>
  </section>
</template>
