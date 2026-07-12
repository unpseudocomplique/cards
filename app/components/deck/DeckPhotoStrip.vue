<script setup lang="ts">
import type { DeckPerson } from '~/types/deck'

const props = defineProps<{
  deckId: string
  persons: DeckPerson[]
}>()

const emit = defineEmits<{
  renamed: []
}>()

const toast = useToast()
const editingPersonId = shallowRef('')
const aliasDraft = shallowRef('')
const savingPersonId = shallowRef('')

const totalPhotos = computed(() => props.persons.reduce((total, person) => total + person.photos.length, 0))

function startRenaming(person: DeckPerson) {
  editingPersonId.value = person.id
  aliasDraft.value = person.label
}

function cancelRenaming() {
  editingPersonId.value = ''
  aliasDraft.value = ''
}

async function renamePerson(person: DeckPerson) {
  const label = aliasDraft.value.trim()

  if (!label) {
    toast.add({
      title: 'Nom requis',
      description: 'Donnez un nom à cette personne.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  if (label === person.label) {
    cancelRenaming()
    return
  }

  savingPersonId.value = person.id

  try {
    await $fetch(`/api/decks/${props.deckId}/persons/${person.id}`, {
      method: 'PATCH',
      body: { label }
    })

    toast.add({
      title: 'Personne renommée',
      description: 'Le nom a été mis à jour.',
      color: 'success',
      icon: 'i-lucide-check'
    })
    cancelRenaming()
    emit('renamed')
  } catch (error) {
    toast.add({
      title: 'Renommage impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    savingPersonId.value = ''
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p class="font-medium text-highlighted">
        Personnes
      </p>
      <UBadge
        color="neutral"
        variant="subtle"
        class="self-start"
      >
        {{ persons.length }} personne(s) · {{ totalPhotos }} photo(s)
      </UBadge>
    </div>

    <div
      v-if="persons.length"
      class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <article
        v-for="person in persons"
        :key="person.id"
        class="min-w-0 rounded-xl border border-default bg-default p-3"
      >
        <div class="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 touch-pan-x">
          <NuxtImg
            v-for="photo in person.photos"
            :key="photo.id"
            :src="photo.url"
            :alt="`${person.label} — ${photo.label}`"
            class="size-14 shrink-0 rounded-md object-cover"
          />
        </div>

        <form
          v-if="editingPersonId === person.id"
          class="space-y-2"
          @submit.prevent="renamePerson(person)"
        >
          <input
            v-model="aliasDraft"
            class="h-9 w-full rounded-md border border-default bg-default px-2 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
            maxlength="80"
            aria-label="Nom de la personne"
          >
          <div class="flex gap-1">
            <UButton
              type="submit"
              size="xs"
              icon="i-lucide-check"
              :loading="savingPersonId === person.id"
            >
              Sauver
            </UButton>
            <UButton
              type="button"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              :disabled="savingPersonId === person.id"
              @click="cancelRenaming"
            >
              Annuler
            </UButton>
          </div>
        </form>

        <div
          v-else
          class="flex items-center justify-between gap-2"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-highlighted">
              {{ person.label }}
            </p>
            <p class="text-xs text-muted">
              {{ person.photos.length }} photo{{ person.photos.length > 1 ? 's' : '' }} de référence
            </p>
          </div>
          <UButton
            :aria-label="`Renommer ${person.label}`"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-pencil"
            square
            @click="startRenaming(person)"
          />
        </div>
      </article>
    </div>

    <UAlert
      v-else
      color="neutral"
      variant="subtle"
      icon="i-lucide-images"
      title="Aucune personne"
      description="Importez plusieurs photos d'une même personne pour affiner la ressemblance."
    />
  </div>
</template>
