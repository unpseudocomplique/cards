<script setup lang="ts">
import type { DeckCard } from '~/types/deck'
import type { CardRolePrompts, CardSuitPrompts } from '~~/shared/utils/cardPromptPresets'
import { mergeRolePrompts, mergeSuitPrompts } from '~~/shared/utils/cardPromptPresets'

type RoleValue = 'number' | 'ace' | 'jack' | 'knight' | 'queen' | 'king' | 'trump' | 'excuse'
type SuitValue = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'trumps'

type GenerateJob = {
  totalCards: number
}

const props = defineProps<{
  deckId: string
  visualStyle: string
  rolePrompts?: CardRolePrompts
  suitPrompts?: CardSuitPrompts
  cards: DeckCard[]
}>()

const emit = defineEmits<{
  updated: []
}>()

const toast = useToast()
const globalPromptDraft = shallowRef(props.visualStyle)
const selectedRolePrompt = shallowRef<RoleValue>('king')
const selectedSuitPrompt = shallowRef<SuitValue>('hearts')
const rolePromptDraft = shallowRef('')
const suitPromptDraft = shallowRef('')
const selectedTestCardId = shallowRef(props.cards[0]?.id || '')
const selectedPromptCardId = shallowRef(props.cards[0]?.id || '')
const cardPromptDraft = shallowRef('')
const selectedCardIds = shallowRef<string[]>([])
const selectedRoleFilter = shallowRef<'all' | RoleValue>('all')
const isSavingGlobalPrompt = shallowRef(false)
const isSavingCardPrompt = shallowRef(false)
const isTestingCard = shallowRef(false)
const isQueueing = shallowRef(false)
const selectedGenerationProgress = shallowRef<{ completed: number, total: number } | null>(null)
const showAdvancedStyle = shallowRef(false)
const showBatchRelaunch = shallowRef(false)

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

const suitOptions: Array<{ value: SuitValue, label: string }> = [
  { value: 'hearts', label: 'Cœurs' },
  { value: 'diamonds', label: 'Carreaux' },
  { value: 'clubs', label: 'Trèfles' },
  { value: 'spades', label: 'Piques' },
  { value: 'trumps', label: 'Atouts' }
]

const statusLabels: Record<DeckCard['status'], string> = {
  pending: 'À faire',
  queued: 'En file',
  generating: 'En cours',
  ready: 'Prête',
  failed: 'À corriger'
}

const statusColors = {
  pending: 'neutral',
  queued: 'info',
  generating: 'warning',
  ready: 'success',
  failed: 'error'
} as const

const roleFilterOptions = computed(() => [
  { value: 'all' as const, label: 'Toutes les cartes' },
  ...roleOptions
])

const cardOptions = computed(() => props.cards.map(card => ({
  id: card.id,
  label: card.metadata.label,
  status: card.status,
  hasPerson: Boolean(card.sourcePersonId)
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
const selectedCards = computed(() => props.cards.filter(card => selectedCardIds.value.includes(card.id)))
const selectedCardsWithPerson = computed(() => selectedCards.value.filter(card => card.sourcePersonId))
const pendingCardsWithPerson = computed(() => props.cards.filter(card =>
  card.sourcePersonId && (card.status === 'pending' || card.status === 'failed' || card.status === 'queued')
))
const readyCount = computed(() => props.cards.filter(card => card.status === 'ready').length)
const cardsNeedingPerson = computed(() => props.cards.filter(card => !card.sourcePersonId).length)
const canGeneratePending = computed(() => pendingCardsWithPerson.value.length > 0)
const selectedGenerationLabel = computed(() => selectedGenerationProgress.value
  ? `Génération ${selectedGenerationProgress.value.completed}/${selectedGenerationProgress.value.total}`
  : `Relancer ${selectedCount.value || ''}`.trim())
const mergedRolePrompts = computed(() => mergeRolePrompts(props.rolePrompts))
const mergedSuitPrompts = computed(() => mergeSuitPrompts(props.suitPrompts))
const stylePreview = computed(() => globalPromptDraft.value.trim() || 'Aucune ambiance définie')

watch(() => props.visualStyle, (visualStyle) => {
  globalPromptDraft.value = visualStyle
})

watch([mergedRolePrompts, selectedRolePrompt], ([rolePrompts, role]) => {
  rolePromptDraft.value = rolePrompts[role]
}, { immediate: true })

watch([mergedSuitPrompts, selectedSuitPrompt], ([suitPrompts, suit]) => {
  suitPromptDraft.value = suitPrompts[suit]
}, { immediate: true })

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
  const rolePrompt = rolePromptDraft.value.trim()
  const suitPrompt = suitPromptDraft.value.trim()

  if (!visualStyle) {
    toast.add({
      title: 'Ambiance manquante',
      description: 'Décrivez brièvement le style souhaité pour le jeu.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  if (showAdvancedStyle.value && (!rolePrompt || !suitPrompt)) {
    toast.add({
      title: 'Champs incomplets',
      description: 'Renseignez le type de personnage et la couleur.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  isSavingGlobalPrompt.value = true

  try {
    await $fetch(`/api/decks/${props.deckId}/prompt`, {
      method: 'PATCH',
      body: showAdvancedStyle.value
        ? {
            visualStyle,
            rolePrompts: {
              [selectedRolePrompt.value]: rolePrompt
            },
            suitPrompts: {
              [selectedSuitPrompt.value]: suitPrompt
            }
          }
        : { visualStyle }
    })

    toast.add({
      title: 'Style enregistré',
      color: 'success',
      icon: 'i-lucide-check'
    })
    emit('updated')
  } catch (error) {
    toast.add({
      title: 'Enregistrement impossible',
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
      title: clear ? 'Détail effacé' : 'Détail enregistré',
      color: 'success',
      icon: 'i-lucide-check'
    })
    emit('updated')
  } catch (error) {
    toast.add({
      title: 'Enregistrement impossible',
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

  if (!selectedTestCard.value.sourcePersonId) {
    toast.add({
      title: 'Personne manquante',
      description: 'Choisissez d’abord qui apparaît sur cette carte.',
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
      title: 'Carte créée',
      description: selectedTestCard.value.metadata.label,
      color: 'success',
      icon: 'i-lucide-check'
    })
    emit('updated')
  } catch (error) {
    toast.add({
      title: 'Création impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
    emit('updated')
  } finally {
    isTestingCard.value = false
  }
}

async function generatePendingCards() {
  if (!canGeneratePending.value) {
    toast.add({
      title: 'Rien à générer',
      description: cardsNeedingPerson.value
        ? 'Affectez d’abord une personne aux cartes restantes.'
        : 'Toutes les cartes prêtes ont déjà un visuel.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  let generatedCount = 0
  let failedCount = 0
  const targets = pendingCardsWithPerson.value

  isQueueing.value = true
  selectedGenerationProgress.value = { completed: 0, total: targets.length }

  try {
    for (const card of targets) {
      try {
        await $fetch(`/api/decks/${props.deckId}/cards/${card.id}/generate`, {
          method: 'POST'
        })
        generatedCount += 1
      } catch {
        failedCount += 1
      }

      selectedGenerationProgress.value = {
        completed: generatedCount + failedCount,
        total: targets.length
      }
    }

    toast.add({
      title: failedCount ? 'Génération terminée avec quelques erreurs' : 'Cartes générées',
      description: `${generatedCount} carte(s) créée(s)${failedCount ? `, ${failedCount} échec(s)` : ''}.`,
      color: failedCount ? 'warning' : 'success',
      icon: failedCount ? 'i-lucide-alert-triangle' : 'i-lucide-check'
    })
    emit('updated')
  } finally {
    isQueueing.value = false
    selectedGenerationProgress.value = null
  }
}

async function queueSelectedCards() {
  if (!selectedCardIds.value.length) {
    toast.add({
      title: 'Aucune carte choisie',
      description: 'Cochez au moins une carte à refaire.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  if (!selectedCardsWithPerson.value.length) {
    toast.add({
      title: 'Personne manquante',
      description: 'Les cartes choisies doivent avoir une personne assignée.',
      color: 'warning',
      icon: 'i-lucide-image-off'
    })
    return
  }

  const skippedCount = selectedCards.value.length - selectedCardsWithPerson.value.length
  let generatedCount = 0
  let failedCount = 0

  isQueueing.value = true
  selectedGenerationProgress.value = { completed: 0, total: selectedCardsWithPerson.value.length }

  try {
    if (skippedCount) {
      toast.add({
        title: 'Certaines cartes sont ignorées',
        description: `${skippedCount} carte(s) sans personne ne seront pas générées.`,
        color: 'warning',
        icon: 'i-lucide-image-off'
      })
    }

    for (const card of selectedCardsWithPerson.value) {
      try {
        await $fetch(`/api/decks/${props.deckId}/cards/${card.id}/generate`, {
          method: 'POST'
        })
        generatedCount += 1
      } catch {
        failedCount += 1
      }

      selectedGenerationProgress.value = {
        completed: generatedCount + failedCount,
        total: selectedCardsWithPerson.value.length
      }
    }

    toast.add({
      title: failedCount ? 'Relance terminée avec erreurs' : 'Cartes mises à jour',
      description: `${generatedCount} carte(s) régénérée(s)${failedCount ? `, ${failedCount} échec(s)` : ''}.`,
      color: failedCount ? 'warning' : 'success',
      icon: failedCount ? 'i-lucide-alert-triangle' : 'i-lucide-check'
    })
    emit('updated')
  } finally {
    isQueueing.value = false
    selectedGenerationProgress.value = null
  }
}

async function queuePendingCards() {
  isQueueing.value = true

  try {
    const job = await $fetch<GenerateJob>(`/api/decks/${props.deckId}/generate`, {
      method: 'POST',
      body: { scope: 'pending' }
    })

    toast.add({
      title: 'File préparée',
      description: `${job.totalCards} carte(s) prêtes à être générées.`,
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
  <section class="space-y-5 rounded-xl border border-default bg-default p-4 sm:space-y-6 sm:p-5">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0 max-w-2xl">
        <h2 class="text-lg font-semibold text-highlighted">
          Créer les visuels
        </h2>
        <p class="mt-1 text-sm text-muted">
          Choisissez l’ambiance du jeu, puis lancez la génération. Les réglages fins restent disponibles si vous en avez besoin.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UBadge
          color="success"
          variant="subtle"
        >
          {{ readyCount }} prête(s)
        </UBadge>
        <UBadge
          color="neutral"
          variant="subtle"
        >
          {{ pendingCardsWithPerson.length }} à générer
        </UBadge>
      </div>
    </div>

    <div class="rounded-xl bg-muted/50 p-3 sm:p-4">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
          <p class="text-sm font-medium text-highlighted">
            Lancer la génération
          </p>
          <p class="mt-1 text-sm text-muted">
            {{ canGeneratePending
              ? `${pendingCardsWithPerson.length} carte(s) avec une personne sont prêtes à être illustrées.`
              : cardsNeedingPerson
                ? `${cardsNeedingPerson} carte(s) n’ont pas encore de personne assignée.`
                : 'Toutes les cartes disponibles ont déjà un visuel.' }}
          </p>
          <UProgress
            v-if="selectedGenerationProgress"
            class="mt-3 w-full max-w-sm"
            :model-value="Math.round((selectedGenerationProgress.completed / selectedGenerationProgress.total) * 100)"
          />
        </div>
        <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <UButton
            size="lg"
            class="w-full justify-center sm:w-auto"
            icon="i-lucide-sparkles"
            :loading="isQueueing"
            :disabled="!canGeneratePending && !isQueueing"
            @click="generatePendingCards"
          >
            {{ selectedGenerationProgress
              ? `Génération ${selectedGenerationProgress.completed}/${selectedGenerationProgress.total}`
              : 'Générer les cartes' }}
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            class="w-full justify-center sm:w-auto"
            icon="i-lucide-flask-conical"
            :loading="isTestingCard"
            :disabled="!selectedTestCard"
            @click="testSelectedCard"
          >
            Tester une carte
          </UButton>
        </div>
      </div>

      <div class="mt-4 grid gap-3 border-t border-default pt-4">
        <UFormField
          label="Carte à tester"
          hint="Idéal pour vérifier le style avant de tout générer."
        >
          <select
            v-model="selectedTestCardId"
            class="h-10 w-full max-w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
          >
            <option
              v-for="card in cardOptions"
              :key="card.id"
              :value="card.id"
            >
              {{ card.label }} — {{ statusLabels[card.status] }}{{ card.hasPerson ? '' : ' (sans personne)' }}
            </option>
          </select>
        </UFormField>
        <UAlert
          v-if="selectedTestCard && !selectedTestCard.sourcePersonId"
          color="warning"
          variant="subtle"
          icon="i-lucide-user-round-x"
          title="Personne manquante"
          description="Assignez quelqu’un à cette carte pour la tester."
        />
      </div>
    </div>

    <div class="space-y-3 rounded-xl border border-default p-3 sm:p-4">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <p class="font-medium text-highlighted">
            Ambiance du jeu
          </p>
          <p class="mt-1 text-sm text-muted">
            Décrivez le rendu souhaité en langage simple : royal, aquarelle, contemporain…
          </p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          class="self-start"
          :icon="showAdvancedStyle ? 'i-lucide-chevron-up' : 'i-lucide-sliders-horizontal'"
          @click="showAdvancedStyle = !showAdvancedStyle"
        >
          {{ showAdvancedStyle ? 'Masquer les détails' : 'Affiner le style' }}
        </UButton>
      </div>

      <UFormField label="Style global">
        <textarea
          v-model="globalPromptDraft"
          class="min-h-24 w-full resize-y rounded-md border border-default bg-default px-3 py-2 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
          maxlength="1200"
          placeholder="Ex. illustration royale contemporaine, traits doux, couleurs chaudes"
        />
      </UFormField>

      <p
        v-if="!showAdvancedStyle"
        class="truncate text-xs text-muted"
      >
        Aperçu : {{ stylePreview }}
      </p>

      <div
        v-if="showAdvancedStyle"
        class="space-y-4 border-t border-default pt-4"
      >
        <div class="grid gap-4 lg:grid-cols-2">
          <UFormField
            label="Type de personnage"
            hint="Rois, dames, valets…"
          >
            <select
              v-model="selectedRolePrompt"
              class="mb-3 h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
            >
              <option
                v-for="role in roleOptions"
                :key="role.value"
                :value="role.value"
              >
                {{ role.label }}
              </option>
            </select>
            <textarea
              v-model="rolePromptDraft"
              class="min-h-28 w-full resize-y rounded-md border border-default bg-default px-3 py-2 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
              maxlength="1600"
            />
          </UFormField>

          <UFormField
            label="Couleur du jeu"
            hint="Cœurs, piques, atouts…"
          >
            <select
              v-model="selectedSuitPrompt"
              class="mb-3 h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
            >
              <option
                v-for="suit in suitOptions"
                :key="suit.value"
                :value="suit.value"
              >
                {{ suit.label }}
              </option>
            </select>
            <textarea
              v-model="suitPromptDraft"
              class="min-h-28 w-full resize-y rounded-md border border-default bg-default px-3 py-2 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
              maxlength="1600"
            />
          </UFormField>
        </div>

        <UFormField
          label="Détail pour une carte"
          hint="Optionnel. Ex. sourire plus franc, manteau bleu…"
        >
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
            class="min-h-28 w-full resize-y rounded-md border border-default bg-default px-3 py-2 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
            maxlength="1200"
            placeholder="Laissez vide pour garder le style général."
          />
        </UFormField>

        <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <UButton
            class="w-full justify-center sm:w-auto"
            icon="i-lucide-save"
            :loading="isSavingGlobalPrompt"
            @click="saveGlobalPrompt"
          >
            Enregistrer le style
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            class="w-full justify-center sm:w-auto"
            icon="i-lucide-save"
            :loading="isSavingCardPrompt"
            @click="saveCardPrompt(false)"
          >
            Enregistrer le détail
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            class="w-full justify-center sm:w-auto"
            icon="i-lucide-eraser"
            :loading="isSavingCardPrompt"
            @click="saveCardPrompt(true)"
          >
            Effacer le détail
          </UButton>
        </div>
      </div>

      <div
        v-else
        class="flex"
      >
        <UButton
          class="w-full justify-center sm:w-auto"
          icon="i-lucide-save"
          :loading="isSavingGlobalPrompt"
          @click="saveGlobalPrompt"
        >
          Enregistrer l’ambiance
        </UButton>
      </div>
    </div>

    <div class="rounded-xl border border-dashed border-default p-3 sm:p-4">
      <button
        type="button"
        class="flex w-full items-start justify-between gap-3 text-left"
        @click="showBatchRelaunch = !showBatchRelaunch"
      >
        <div class="min-w-0">
          <p class="font-medium text-highlighted">
            Refaire certaines cartes
          </p>
          <p class="mt-1 text-sm text-muted">
            Utile si une carte ne vous plaît pas : cochez-la et relancez uniquement celle-là.
          </p>
        </div>
        <UIcon
          :name="showBatchRelaunch ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="mt-0.5 size-5 shrink-0 text-muted"
        />
      </button>

      <div
        v-if="showBatchRelaunch"
        class="mt-4 space-y-3 border-t border-default pt-4"
      >
        <div class="flex flex-col gap-3">
          <select
            v-model="selectedRoleFilter"
            class="h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary sm:max-w-xs"
          >
            <option
              v-for="role in roleFilterOptions"
              :key="role.value"
              :value="role.value"
            >
              {{ role.label }}
            </option>
          </select>
          <div class="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              class="w-full justify-center sm:w-auto"
              icon="i-lucide-check-square"
              @click="selectVisibleCards"
            >
              Tout cocher
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              class="w-full justify-center sm:w-auto"
              icon="i-lucide-square"
              @click="clearSelectedCards"
            >
              Tout décocher
            </UButton>
            <UButton
              size="sm"
              class="w-full justify-center sm:w-auto"
              icon="i-lucide-refresh-cw"
              :loading="isQueueing"
              :disabled="!selectedCount"
              @click="queueSelectedCards"
            >
              {{ selectedGenerationLabel }}
            </UButton>
          </div>
        </div>

        <div class="max-h-80 divide-y divide-default overflow-auto rounded-lg border border-default">
          <label
            v-for="card in visibleCards"
            :key="card.id"
            class="flex cursor-pointer items-center gap-3 p-3 text-sm hover:bg-muted/40"
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
              :color="statusColors[card.status]"
              variant="subtle"
            >
              {{ statusLabels[card.status] }}
            </UBadge>
          </label>
        </div>

        <UButton
          color="neutral"
          variant="link"
          size="sm"
          class="h-auto w-full justify-start whitespace-normal text-left sm:w-auto"
          icon="i-lucide-list-plus"
          :loading="isQueueing"
          @click="queuePendingCards"
        >
          Préparer seulement les cartes encore en attente
        </UButton>
      </div>
    </div>
  </section>
</template>
