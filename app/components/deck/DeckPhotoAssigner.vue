<script setup lang="ts">
import type { DeckCard, DeckPerson } from '~/types/deck'

type RoleValue = 'number' | 'ace' | 'jack' | 'knight' | 'queen' | 'king' | 'trump' | 'excuse'

type AssignmentResponse = {
  assignedCount: number
}

const props = defineProps<{
  deckId: string
  cards: DeckCard[]
  persons: DeckPerson[]
}>()

const emit = defineEmits<{
  assigned: []
}>()

const toast = useToast()
const selectedRole = shallowRef<RoleValue>('queen')
const selectedRolePersonId = shallowRef('')
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

const personById = computed(() => new Map(props.persons.map(person => [person.id, person])))
const visibleCards = computed(() => {
  if (selectedCardRole.value === 'all') {
    return props.cards
  }

  return props.cards.filter(card => card.metadata.role === selectedCardRole.value)
})

function getCardPerson(card: DeckCard) {
  if (!card.sourcePersonId) {
    return null
  }

  return personById.value.get(card.sourcePersonId) || null
}

async function assignRole(clear = false) {
  if (!clear && !selectedRolePersonId.value) {
    toast.add({
      title: 'Personne manquante',
      description: 'Choisissez une personne à appliquer au groupe.',
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
        personId: clear ? null : selectedRolePersonId.value
      }
    })

    toast.add({
      title: clear ? 'Affectations supprimées' : 'Personne affectée',
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

async function assignCard(card: DeckCard, personId: string) {
  assigningCardId.value = card.id

  try {
    await $fetch(`/api/decks/${props.deckId}/assignments`, {
      method: 'PATCH',
      body: {
        scope: 'card',
        cardId: card.id,
        personId: personId || null
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

function handleCardPersonChange(card: DeckCard, event: Event) {
  const target = event.target as HTMLSelectElement | null

  void assignCard(card, target?.value || '')
}
</script>

<template>
  <section class="space-y-5 rounded-xl border border-default bg-default p-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h2 class="font-semibold text-highlighted">
          Qui apparaît sur les cartes ?
        </h2>
        <p class="mt-1 text-sm text-muted">
          Choisissez une personne pour un groupe (ex. toutes les dames), ou carte par carte.
        </p>
      </div>
      <UBadge
        color="neutral"
        variant="subtle"
        class="self-start"
      >
        {{ persons.length }} personne(s)
      </UBadge>
    </div>

    <UAlert
      v-if="!persons.length"
      color="neutral"
      variant="subtle"
      icon="i-lucide-upload"
      title="Ajoutez d’abord des photos"
      description="Importez au moins une personne pour pouvoir l’associer aux cartes."
    />

    <div
      v-else
      class="space-y-5"
    >
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
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

        <UFormField label="Personne">
          <select
            v-model="selectedRolePersonId"
            class="h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">
              Choisir une personne
            </option>
            <option
              v-for="person in persons"
              :key="person.id"
              :value="person.id"
            >
              {{ person.label }} ({{ person.photos.length }})
            </option>
          </select>
        </UFormField>

        <UButton
          class="w-full justify-center"
          icon="i-lucide-check"
          :loading="isAssigningRole"
          @click="assignRole(false)"
        >
          Appliquer
        </UButton>

        <UButton
          color="neutral"
          variant="subtle"
          class="w-full justify-center"
          icon="i-lucide-x"
          :loading="isAssigningRole"
          @click="assignRole(true)"
        >
          Vider
        </UButton>
      </div>

      <div class="space-y-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="font-medium text-highlighted">
              Carte par carte
            </p>
            <p class="text-sm text-muted">
              Une affectation spécifique remplace le choix de groupe pour cette carte.
            </p>
          </div>
          <select
            v-model="selectedCardRole"
            class="h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary sm:w-auto sm:min-w-48"
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
            class="grid gap-3 p-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)] md:items-center"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-highlighted">
                {{ card.metadata.label }}
              </p>
              <p class="text-xs text-muted">
                {{ card.metadata.shortLabel }} · {{ roleLabelByValue[card.metadata.role as RoleValue] || card.metadata.role }}
              </p>
            </div>

            <div class="flex min-w-0 items-center gap-2 text-xs text-muted">
              <NuxtImg
                v-if="getCardPerson(card)?.photos[0]"
                :src="getCardPerson(card)!.photos[0]!.url"
                :alt="getCardPerson(card)!.label"
                class="size-9 shrink-0 rounded object-cover"
              />
              <span class="truncate">
                {{ getCardPerson(card) ? `${getCardPerson(card)!.label} · ${getCardPerson(card)!.photos.length} photo(s)` : 'Aucune personne' }}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <select
                :value="card.sourcePersonId || ''"
                class="h-10 min-w-0 flex-1 rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
                :disabled="assigningCardId === card.id"
                @change="handleCardPersonChange(card, $event)"
              >
                <option value="">
                  Aucune
                </option>
                <option
                  v-for="person in persons"
                  :key="person.id"
                  :value="person.id"
                >
                  {{ person.label }} ({{ person.photos.length }})
                </option>
              </select>
              <UIcon
                v-if="assigningCardId === card.id"
                name="i-lucide-loader-2"
                class="size-4 shrink-0 animate-spin text-muted"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
