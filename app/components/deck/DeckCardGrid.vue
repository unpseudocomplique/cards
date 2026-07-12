<script setup lang="ts">
import type { CardRolePromptKey, CardSuitPromptKey, DeckCard, DeckPerson } from '~/types/deck'

type RoleFilterValue = 'all' | 'face' | CardRolePromptKey
type SuitFilterValue = 'all' | CardSuitPromptKey

type AssignmentResponse = {
  assignedCount: number
}

type PersonSelectItem = {
  value: string
  label: string
  description: string
  imageUrl: string | null
  photoCount: number
  generatedCount: number
}

const props = defineProps<{
  deckId: string
  cards: DeckCard[]
  persons: DeckPerson[]
}>()

const emit = defineEmits<{
  'card-updated': [card: DeckCard]
}>()

const toast = useToast()
const selectedSuitFilter = shallowRef<SuitFilterValue>('all')
const selectedRoleFilter = shallowRef<RoleFilterValue>('all')
const assigningCardIds = shallowRef(new Set<string>())
const regeneratingCardIds = shallowRef(new Set<string>())

const faceRoles: CardRolePromptKey[] = ['jack', 'knight', 'queen', 'king']
const noPersonValue = '__no_person__'
const emptyPersonSelectItem: PersonSelectItem = {
  value: noPersonValue,
  label: 'Aucune personne',
  description: 'Aucune référence affectée',
  imageUrl: null,
  photoCount: 0,
  generatedCount: 0
}

const suitLabels: Record<CardSuitPromptKey, string> = {
  hearts: 'Coeurs',
  diamonds: 'Carreaux',
  clubs: 'Trèfles',
  spades: 'Piques',
  trumps: 'Atouts'
}

const roleLabels: Record<CardRolePromptKey, string> = {
  number: 'Numérales',
  ace: 'As',
  jack: 'Valets',
  knight: 'Cavaliers',
  queen: 'Dames',
  king: 'Rois',
  trump: 'Atouts',
  excuse: 'Excuse'
}

const roleFilterOptions: Array<{ value: RoleFilterValue, label: string }> = [
  { value: 'all', label: 'Tous les types' },
  { value: 'face', label: 'Têtes' },
  { value: 'king', label: 'Rois' },
  { value: 'queen', label: 'Dames' },
  { value: 'knight', label: 'Cavaliers' },
  { value: 'jack', label: 'Valets' },
  { value: 'trump', label: 'Atouts' },
  { value: 'excuse', label: 'Excuse' },
  { value: 'ace', label: 'As' },
  { value: 'number', label: 'Numérales' }
]

const statusLabels: Record<DeckCard['status'], string> = {
  pending: 'À faire',
  queued: 'En file',
  generating: 'En cours',
  ready: 'Prête',
  failed: 'À corriger'
}

const statusColor = computed(() => ({
  pending: 'neutral',
  queued: 'info',
  generating: 'warning',
  ready: 'success',
  failed: 'error'
} as const))

const displayedCards = computed(() => props.cards)
const readyCount = computed(() => displayedCards.value.filter(card => card.status === 'ready').length)
const filteredReadyCount = computed(() => visibleCards.value.filter(card => card.status === 'ready').length)
const personById = computed(() => new Map(props.persons.map(person => [person.id, person])))
const generatedCountByPersonId = computed(() => {
  const counts = new Map<string, number>()

  for (const card of displayedCards.value) {
    if (!card.sourcePersonId || card.status !== 'ready' || !card.finalImageUrl) {
      continue
    }

    counts.set(card.sourcePersonId, (counts.get(card.sourcePersonId) || 0) + 1)
  }

  return counts
})

const suitFilterOptions = computed(() => {
  const availableSuits = new Set(displayedCards.value.map(card => card.metadata.suit).filter(Boolean))

  return [
    { value: 'all' as const, label: 'Toutes les couleurs' },
    ...Object.entries(suitLabels)
      .filter(([value]) => availableSuits.has(value))
      .map(([value, label]) => ({ value: value as CardSuitPromptKey, label }))
  ]
})

const visibleCards = computed(() => displayedCards.value.filter((card) => {
  const matchesSuit = selectedSuitFilter.value === 'all' || card.metadata.suit === selectedSuitFilter.value
  const matchesRole = selectedRoleFilter.value === 'all'
    || (selectedRoleFilter.value === 'face' && faceRoles.includes(card.metadata.role as CardRolePromptKey))
    || card.metadata.role === selectedRoleFilter.value

  return matchesSuit && matchesRole
}))

const personSelectItems = computed<PersonSelectItem[]>(() => [
  emptyPersonSelectItem,
  ...props.persons.map((person) => {
    const generatedCount = generatedCountByPersonId.value.get(person.id) || 0

    return {
      value: person.id,
      label: person.label,
      description: `${person.photos.length} photo(s) · ${getGeneratedCountLabel(generatedCount)}`,
      imageUrl: person.photos[0]?.url || null,
      photoCount: person.photos.length,
      generatedCount
    }
  })
])

function getCardPerson(card: DeckCard) {
  if (!card.sourcePersonId) {
    return null
  }

  return personById.value.get(card.sourcePersonId) || null
}

function getRoleLabel(card: DeckCard) {
  return roleLabels[card.metadata.role as CardRolePromptKey] || card.metadata.role || 'Carte'
}

function getSuitLabel(card: DeckCard) {
  return card.metadata.suit ? suitLabels[card.metadata.suit as CardSuitPromptKey] || card.metadata.suit : null
}

function getCardSubtitle(card: DeckCard) {
  const suitLabel = getSuitLabel(card)

  return suitLabel ? `${getRoleLabel(card)} · ${suitLabel}` : getRoleLabel(card)
}

function getGeneratedCountLabel(count: number) {
  return count === 1 ? '1 visuel généré dans ce deck' : `${count} visuels générés dans ce deck`
}

function getPersonSelectItem(value: unknown) {
  const personId = typeof value === 'string' ? value : noPersonValue

  return personSelectItems.value.find(item => item.value === personId) || emptyPersonSelectItem
}

function getPersonSelectTriggerLabel(value: unknown) {
  const item = getPersonSelectItem(value)

  return item.value !== noPersonValue ? `${item.label} · ${item.description}` : item.label
}

function addCardLoadingState(state: typeof assigningCardIds, cardId: string) {
  const nextIds = new Set(state.value)

  nextIds.add(cardId)
  state.value = nextIds
}

function removeCardLoadingState(state: typeof assigningCardIds, cardId: string) {
  const nextIds = new Set(state.value)

  nextIds.delete(cardId)
  state.value = nextIds
}

function isAssigningCard(card: DeckCard) {
  return assigningCardIds.value.has(card.id)
}

function isRegeneratingCard(card: DeckCard) {
  return regeneratingCardIds.value.has(card.id)
}

async function assignCard(card: DeckCard, personId: string) {
  addCardLoadingState(assigningCardIds, card.id)

  try {
    const response = await $fetch<AssignmentResponse>(`/api/decks/${props.deckId}/assignments`, {
      method: 'PATCH',
      body: {
        scope: 'card',
        cardId: card.id,
        personId: personId || null
      }
    })

    toast.add({
      title: personId ? 'Personne affectée' : 'Personne retirée',
      description: `${response.assignedCount} carte mise à jour.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
    emit('card-updated', {
      ...card,
      sourcePersonId: personId || null,
      sourcePhotoId: personId ? (personById.value.get(personId)?.photos[0]?.id || null) : null
    })
  } catch (error) {
    const failedCard = getApiErrorCard(error)

    if (failedCard) {
      emit('card-updated', failedCard)
    }

    toast.add({
      title: 'Affectation impossible',
      description: getApiErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    removeCardLoadingState(assigningCardIds, card.id)
  }
}

async function regenerateCard(card: DeckCard) {
  if (!card.sourcePersonId) {
    toast.add({
      title: 'Personne manquante',
      description: 'Affectez une personne à cette carte avant de régénérer son visuel.',
      color: 'warning',
      icon: 'i-lucide-image-off'
    })
    return
  }

  addCardLoadingState(regeneratingCardIds, card.id)
  emit('card-updated', { ...card, status: 'generating', errorMessage: null })

  try {
    const updatedCard = await $fetch<DeckCard>(`/api/decks/${props.deckId}/cards/${card.id}/generate`, {
      method: 'POST'
    })

    toast.add({
      title: 'Image régénérée',
      description: card.metadata.label,
      color: 'success',
      icon: 'i-lucide-sparkles'
    })
    emit('card-updated', updatedCard)
  } catch (error) {
    const failedCard = getApiErrorCard(error)

    if (failedCard) {
      emit('card-updated', failedCard)
    } else {
      emit('card-updated', {
        ...card,
        status: 'failed',
        errorMessage: getApiErrorMessage(error)
      })
    }

    toast.add({
      title: 'Génération impossible',
      description: getApiErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    removeCardLoadingState(regeneratingCardIds, card.id)
  }
}

function handleCardPersonUpdate(card: DeckCard, personId: unknown) {
  void assignCard(card, typeof personId === 'string' && personId !== noPersonValue ? personId : '')
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <p class="font-medium text-highlighted">
          Visuels des cartes
        </p>
        <p class="text-sm text-muted">
          <span class="sm:hidden">{{ filteredReadyCount }}/{{ visibleCards.length }} prêtes</span>
          <span class="hidden sm:inline">{{ filteredReadyCount }} / {{ visibleCards.length }} prêtes sur la sélection · {{ readyCount }} / {{ cards.length }} au total</span>
        </p>
      </div>
      <div class="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-lg">
        <UFormField label="Couleur">
          <USelect
            v-model="selectedSuitFilter"
            :items="suitFilterOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Type">
          <USelect
            v-model="selectedRoleFilter"
            :items="roleFilterOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <article
        v-for="card in visibleCards"
        :key="card.id"
        class="overflow-hidden rounded-xl border border-default bg-default"
      >
        <div class="aspect-3/4 bg-muted/70 p-2 sm:p-2.5">
          <NuxtImg
            v-if="card.finalImageUrl"
            :src="card.finalImageUrl"
            :alt="card.metadata.label"
            class="size-full rounded-[7%] object-contain shadow-sm shadow-neutral-950/10"
          />
          <div
            v-else
            class="flex size-full flex-col items-center justify-center gap-2 rounded-[7%] border border-dashed border-default bg-default/70 p-3 text-center"
          >
            <UIcon
              name="i-lucide-image"
              class="size-6 text-muted"
            />
            <span class="text-xs text-muted">En attente</span>
          </div>
        </div>
        <div class="space-y-2 p-3 pt-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium leading-snug text-highlighted">
                {{ card.metadata.label }}
              </p>
              <p class="mt-1 truncate text-xs text-muted">
                {{ getCardSubtitle(card) }}
              </p>
            </div>
            <span class="shrink-0 text-sm font-bold text-muted">{{ card.metadata.shortLabel }}</span>
          </div>

          <div class="flex min-w-0 flex-wrap items-center gap-1.5">
            <UBadge
              :color="statusColor[card.status]"
              variant="subtle"
              size="sm"
            >
              {{ statusLabels[card.status] }}
            </UBadge>
            <UBadge
              color="neutral"
              variant="outline"
              size="sm"
              class="max-w-full truncate"
            >
              {{ getCardPerson(card)?.label || 'Sans personne' }}
            </UBadge>
          </div>

          <p
            v-if="card.status === 'failed' && card.errorMessage"
            class="text-xs leading-snug text-error"
          >
            {{ card.errorMessage }}
          </p>

          <div class="space-y-2 pt-1">
            <USelect
              :model-value="card.sourcePersonId || noPersonValue"
              :items="personSelectItems"
              value-key="value"
              label-key="label"
              description-key="description"
              class="w-full min-w-0"
              :disabled="!persons.length || isAssigningCard(card) || isRegeneratingCard(card)"
              :ui="{ content: 'w-(--reka-select-trigger-width) max-w-[min(20rem,calc(100vw-2rem))]', itemWrapper: 'min-w-0' }"
              @update:model-value="handleCardPersonUpdate(card, $event)"
            >
              <template #leading="{ modelValue }">
                <NuxtImg
                  v-if="getPersonSelectItem(modelValue).imageUrl"
                  :src="getPersonSelectItem(modelValue).imageUrl!"
                  :alt="getPersonSelectItem(modelValue).label"
                  class="size-5 rounded object-cover"
                />
                <UIcon
                  v-else
                  name="i-lucide-image-off"
                  class="size-4 text-muted"
                />
              </template>

              <template #default="{ modelValue }">
                <span class="truncate">
                  {{ getPersonSelectTriggerLabel(modelValue) }}
                </span>
              </template>

              <template #item-leading="{ item }">
                <NuxtImg
                  v-if="item.imageUrl"
                  :src="item.imageUrl"
                  :alt="item.label"
                  class="size-9 rounded object-cover"
                />
                <span
                  v-else
                  class="flex size-9 items-center justify-center rounded bg-muted"
                >
                  <UIcon
                    name="i-lucide-image-off"
                    class="size-4 text-muted"
                  />
                </span>
              </template>

              <template #item-label="{ item }">
                <span class="truncate">
                  {{ item.label }}
                </span>
              </template>

              <template #item-description="{ item }">
                {{ item.description }}
              </template>

              <template #item-trailing="{ item }">
                <UBadge
                  v-if="item.value !== noPersonValue"
                  color="neutral"
                  variant="subtle"
                >
                  {{ item.photoCount }}
                </UBadge>
              </template>
            </USelect>

            <UButton
              block
              size="sm"
              icon="i-lucide-refresh-cw"
              :loading="isRegeneratingCard(card)"
              :disabled="isAssigningCard(card)"
              @click="regenerateCard(card)"
            >
              Régénérer
            </UButton>
          </div>
        </div>
      </article>
    </div>

    <UAlert
      v-if="!visibleCards.length"
      color="neutral"
      variant="subtle"
      icon="i-lucide-filter-x"
      title="Aucune carte"
      description="Aucune carte ne correspond aux filtres sélectionnés."
    />
  </div>
</template>
