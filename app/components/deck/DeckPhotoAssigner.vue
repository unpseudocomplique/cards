<script setup lang="ts">
import type { DeckCard, DeckPhoto } from '~/types/deck'

type RoleValue = 'number' | 'ace' | 'jack' | 'knight' | 'queen' | 'king' | 'trump' | 'excuse'

type AssignmentResponse = {
  assignedCount: number
}

const props = defineProps<{
  deckId: string
  cards: DeckCard[]
  photos: DeckPhoto[]
}>()

const emit = defineEmits<{
  assigned: []
}>()

const toast = useToast()
const selectedRole = shallowRef<RoleValue>('queen')
const selectedRolePhotoId = shallowRef('')
const selectedCardRole = shallowRef<'all' | RoleValue>('all')
const isAssigningRole = shallowRef(false)
const assigningCardId = shallowRef('')

const roleOptions: Array<{ value: RoleValue, label: string }> = [
  { value: 'queen', label: 'Toutes les Dames' },
  { value: 'king', label: 'Tous les Rois' },
  { value: 'jack', label: 'Tous les Valets' },
  { value: 'knight', label: 'Tous les Cavaliers' },
  { value: 'trump', label: 'Tous les Atouts' },
  { value: 'excuse', label: 'L\'Excuse' },
  { value: 'ace', label: 'Tous les As' },
  { value: 'number', label: 'Toutes les cartes numérales' }
]

const roleLabelByValue = Object.fromEntries(
  roleOptions.map(role => [role.value, role.label.replace(/^(Toutes les|Tous les|Tous|L')\s?/, '')])
) as Record<RoleValue, string>

const cardRoleFilterOptions = computed(() => [
  { value: 'all' as const, label: 'Toutes les cartes' },
  ...roleOptions
])

const photoById = computed(() => new Map(props.photos.map(photo => [photo.id, photo])))
const visibleCards = computed(() => {
  if (selectedCardRole.value === 'all') {
    return props.cards
  }

  return props.cards.filter(card => card.metadata.role === selectedCardRole.value)
})

function getCardPhoto(card: DeckCard) {
  if (!card.sourcePhotoId) {
    return null
  }

  return photoById.value.get(card.sourcePhotoId) || null
}

async function assignRole(clear = false) {
  if (!clear && !selectedRolePhotoId.value) {
    toast.add({
      title: 'Photo manquante',
      description: 'Choisissez une photo à appliquer au groupe.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  isAssigningRole.value = true

  try {
    const response = await $fetch<AssignmentResponse>(`/api/decks/${props.deckId}/assignments`, {
      method: 'PATCH',
      body: {
        scope: 'role',
        role: selectedRole.value,
        photoId: clear ? null : selectedRolePhotoId.value
      }
    })

    toast.add({
      title: clear ? 'Affectations supprimées' : 'Photo affectée',
      description: `${response.assignedCount} carte(s) mises à jour.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
    emit('assigned')
  } catch (error) {
    toast.add({
      title: 'Affectation impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    isAssigningRole.value = false
  }
}

async function assignCard(card: DeckCard, photoId: string) {
  assigningCardId.value = card.id

  try {
    await $fetch(`/api/decks/${props.deckId}/assignments`, {
      method: 'PATCH',
      body: {
        scope: 'card',
        cardId: card.id,
        photoId: photoId || null
      }
    })

    emit('assigned')
  } catch (error) {
    toast.add({
      title: 'Affectation impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    assigningCardId.value = ''
  }
}

function handleCardPhotoChange(card: DeckCard, event: Event) {
  const target = event.target as HTMLSelectElement | null

  void assignCard(card, target?.value || '')
}
</script>

<template>
  <section class="space-y-5 rounded-lg border border-default bg-default p-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="font-semibold text-highlighted">
          Affecter les photos
        </h2>
        <p class="mt-1 text-sm text-muted">
          Appliquez une photo à un groupe de personnages ou choisissez carte par carte.
        </p>
      </div>
      <UBadge
        color="neutral"
        variant="subtle"
      >
        {{ photos.length }} photo(s)
      </UBadge>
    </div>

    <UAlert
      v-if="!photos.length"
      color="neutral"
      variant="subtle"
      icon="i-lucide-upload"
      title="Importez d'abord une photo"
      description="Les contrôles d'affectation seront disponibles dès qu'une photo sera ajoutée au deck."
    />

    <div
      v-else
      class="space-y-5"
    >
      <div class="grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
        <UFormField label="Groupe">
          <select
            v-model="selectedRole"
            class="h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
          >
            <option
              v-for="role in roleOptions"
              :key="role.value"
              :value="role.value"
            >
              {{ role.label }}
            </option>
          </select>
        </UFormField>

        <UFormField label="Photo">
          <select
            v-model="selectedRolePhotoId"
            class="h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">
              Choisir une photo
            </option>
            <option
              v-for="photo in photos"
              :key="photo.id"
              :value="photo.id"
            >
              {{ photo.label }}
            </option>
          </select>
        </UFormField>

        <UButton
          icon="i-lucide-check"
          :loading="isAssigningRole"
          @click="assignRole(false)"
        >
          Appliquer
        </UButton>

        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-x"
          :loading="isAssigningRole"
          @click="assignRole(true)"
        >
          Vider
        </UButton>
      </div>

      <div class="space-y-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-medium text-highlighted">
              Carte par carte
            </p>
            <p class="text-sm text-muted">
              Une affectation spécifique remplace le choix de groupe pour cette carte.
            </p>
          </div>
          <select
            v-model="selectedCardRole"
            class="h-10 rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
          >
            <option
              v-for="role in cardRoleFilterOptions"
              :key="role.value"
              :value="role.value"
            >
              {{ role.label }}
            </option>
          </select>
        </div>

        <div class="max-h-136 divide-y divide-default overflow-auto rounded-lg border border-default">
          <div
            v-for="card in visibleCards"
            :key="card.id"
            class="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_11rem_minmax(12rem,16rem)] sm:items-center"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-highlighted">
                {{ card.metadata.label }}
              </p>
              <p class="text-xs text-muted">
                {{ card.metadata.shortLabel }} · {{ roleLabelByValue[card.metadata.role as RoleValue] || card.metadata.role }}
              </p>
            </div>

            <div class="flex items-center gap-2 text-xs text-muted">
              <NuxtImg
                v-if="getCardPhoto(card)"
                :src="getCardPhoto(card)!.url"
                :alt="getCardPhoto(card)!.label"
                class="size-9 rounded object-cover"
              />
              <span class="truncate">
                {{ getCardPhoto(card)?.label || 'Aucune photo' }}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <select
                :value="card.sourcePhotoId || ''"
                class="h-10 min-w-0 flex-1 rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
                :disabled="assigningCardId === card.id"
                @change="handleCardPhotoChange(card, $event)"
              >
                <option value="">
                  Aucune
                </option>
                <option
                  v-for="photo in photos"
                  :key="photo.id"
                  :value="photo.id"
                >
                  {{ photo.label }}
                </option>
              </select>
              <UIcon
                v-if="assigningCardId === card.id"
                name="i-lucide-loader-2"
                class="size-4 animate-spin text-muted"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
