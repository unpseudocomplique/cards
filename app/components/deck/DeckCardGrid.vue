<script setup lang="ts">
import type { CardRolePromptKey, CardSuitPromptKey, DeckCard, DeckPhoto } from '~/types/deck'

type RoleFilterValue = 'all' | 'face' | CardRolePromptKey
type SuitFilterValue = 'all' | CardSuitPromptKey

type AssignmentResponse = {
  assignedCount: number
}

type PhotoSelectItem = {
  value: string
  label: string
  description: string
  imageUrl: string | null
  generatedCount: number
}

const props = defineProps<{
  deckId: string
  cards: DeckCard[]
  photos: DeckPhoto[]
}>()

defineEmits<{
  updated: []
}>()

const toast = useToast()
const selectedSuitFilter = shallowRef<SuitFilterValue>('all')
const selectedRoleFilter = shallowRef<RoleFilterValue>('all')
const assigningCardIds = shallowRef(new Set<string>())
const regeneratingCardIds = shallowRef(new Set<string>())
const cardOverrides = shallowRef(new Map<string, DeckCard>())

const faceRoles: CardRolePromptKey[] = ['jack', 'knight', 'queen', 'king']
const noPhotoValue = '__no_photo__'
const emptyPhotoSelectItem: PhotoSelectItem = {
  value: noPhotoValue,
  label: 'Aucune photo',
  description: 'Aucune image source affectée',
  imageUrl: null,
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

const statusColor = computed(() => ({
  pending: 'neutral',
  queued: 'info',
  generating: 'warning',
  ready: 'success',
  failed: 'error'
} as const))

const displayedCards = computed(() => props.cards.map(card => cardOverrides.value.get(card.id) || card))
const readyCount = computed(() => displayedCards.value.filter(card => card.status === 'ready').length)
const filteredReadyCount = computed(() => visibleCards.value.filter(card => card.status === 'ready').length)
const photoById = computed(() => new Map(props.photos.map(photo => [photo.id, photo])))
const generatedCountByPhotoId = computed(() => {
  const counts = new Map<string, number>()

  for (const card of displayedCards.value) {
    if (!card.sourcePhotoId || card.status !== 'ready' || !card.finalImageUrl) {
      continue
    }

    counts.set(card.sourcePhotoId, (counts.get(card.sourcePhotoId) || 0) + 1)
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

const photoSelectItems = computed<PhotoSelectItem[]>(() => [
  emptyPhotoSelectItem,
  ...props.photos.map((photo) => {
    const generatedCount = generatedCountByPhotoId.value.get(photo.id) || 0

    return {
      value: photo.id,
      label: photo.label,
      description: getGeneratedCountLabel(generatedCount),
      imageUrl: photo.url,
      generatedCount
    }
  })
])

watch(() => props.cards, () => {
  cardOverrides.value = new Map()
})

function getCardPhoto(card: DeckCard) {
  if (!card.sourcePhotoId) {
    return null
  }

  return photoById.value.get(card.sourcePhotoId) || null
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

function getPhotoSelectItem(value: unknown) {
  const photoId = typeof value === 'string' ? value : noPhotoValue

  return photoSelectItems.value.find(item => item.value === photoId) || emptyPhotoSelectItem
}

function getPhotoSelectTriggerLabel(value: unknown) {
  const item = getPhotoSelectItem(value)

  return item.value !== noPhotoValue ? `${item.label} · ${item.description}` : item.label
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

function updateCardOverride(card: DeckCard) {
  const nextCards = new Map(cardOverrides.value)

  nextCards.set(card.id, card)
  cardOverrides.value = nextCards
}

async function assignCard(card: DeckCard, photoId: string) {
  addCardLoadingState(assigningCardIds, card.id)

  try {
    const response = await $fetch<AssignmentResponse>(`/api/decks/${props.deckId}/assignments`, {
      method: 'PATCH',
      body: {
        scope: 'card',
        cardId: card.id,
        photoId: photoId || null
      }
    })

    toast.add({
      title: photoId ? 'Photo affectée' : 'Photo retirée',
      description: `${response.assignedCount} carte mise à jour.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
    updateCardOverride({
      ...card,
      sourcePhotoId: photoId || null
    })
  } catch (error) {
    toast.add({
      title: 'Affectation impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    removeCardLoadingState(assigningCardIds, card.id)
  }
}

async function regenerateCard(card: DeckCard) {
  if (!card.sourcePhotoId) {
    toast.add({
      title: 'Photo manquante',
      description: 'Affectez une photo à cette carte avant de régénérer son visuel.',
      color: 'warning',
      icon: 'i-lucide-image-off'
    })
    return
  }

  addCardLoadingState(regeneratingCardIds, card.id)

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
    updateCardOverride(updatedCard)
  } catch (error) {
    toast.add({
      title: 'Génération impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    removeCardLoadingState(regeneratingCardIds, card.id)
  }
}

function handleCardPhotoUpdate(card: DeckCard, photoId: unknown) {
  void assignCard(card, typeof photoId === 'string' && photoId !== noPhotoValue ? photoId : '')
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="font-medium text-highlighted">
          Visuels des cartes
        </p>
        <p class="text-sm text-muted">
          {{ filteredReadyCount }} / {{ visibleCards.length }} prêtes sur la sélection · {{ readyCount }} / {{ cards.length }} au total
        </p>
      </div>
      <div class="grid gap-2 sm:grid-cols-2 lg:min-w-lg">
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

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <article
        v-for="card in visibleCards"
        :key="card.id"
        class="overflow-hidden rounded-lg border border-default bg-default"
      >
        <div class="aspect-3/4 bg-muted">
          <NuxtImg
            v-if="card.finalImageUrl"
            :src="card.finalImageUrl"
            :alt="card.metadata.label"
            class="size-full object-cover"
          />
          <div
            v-else
            class="flex size-full flex-col items-center justify-center gap-2 p-3 text-center"
          >
            <UIcon
              name="i-lucide-image"
              class="size-6 text-muted"
            />
            <span class="text-xs text-muted">En attente</span>
          </div>
        </div>
        <div class="space-y-2 p-3">
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

          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :color="statusColor[card.status]"
              variant="subtle"
            >
              {{ card.status }}
            </UBadge>
            <UBadge
              color="neutral"
              variant="outline"
            >
              {{ getCardPhoto(card)?.label || 'Sans photo' }}
            </UBadge>
          </div>

          <div class="space-y-2 pt-1">
            <USelect
              :model-value="card.sourcePhotoId || noPhotoValue"
              :items="photoSelectItems"
              value-key="value"
              label-key="label"
              description-key="description"
              class="w-full"
              :disabled="!photos.length || isAssigningCard(card) || isRegeneratingCard(card)"
              :ui="{ content: 'min-w-72', itemWrapper: 'min-w-0' }"
              @update:model-value="handleCardPhotoUpdate(card, $event)"
            >
              <template #leading="{ modelValue }">
                <NuxtImg
                  v-if="getPhotoSelectItem(modelValue).imageUrl"
                  :src="getPhotoSelectItem(modelValue).imageUrl!"
                  :alt="getPhotoSelectItem(modelValue).label"
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
                  {{ getPhotoSelectTriggerLabel(modelValue) }}
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
                  v-if="item.value !== noPhotoValue"
                  color="neutral"
                  variant="subtle"
                >
                  {{ item.generatedCount }}
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
