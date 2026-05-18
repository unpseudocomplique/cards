<script setup lang="ts">
import type { DeckPhoto } from '~/types/deck'

const props = defineProps<{
  deckId: string
  photos: DeckPhoto[]
}>()

const emit = defineEmits<{
  renamed: []
}>()

const toast = useToast()
const editingPhotoId = shallowRef('')
const aliasDraft = shallowRef('')
const savingPhotoId = shallowRef('')

function startRenaming(photo: DeckPhoto) {
  editingPhotoId.value = photo.id
  aliasDraft.value = photo.label
}

function cancelRenaming() {
  editingPhotoId.value = ''
  aliasDraft.value = ''
}

async function renamePhoto(photo: DeckPhoto) {
  const label = aliasDraft.value.trim()

  if (!label) {
    toast.add({
      title: 'Alias requis',
      description: 'Donnez un nom à cette photo pour la retrouver facilement.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  if (label === photo.label) {
    cancelRenaming()
    return
  }

  savingPhotoId.value = photo.id

  try {
    await $fetch(`/api/decks/${props.deckId}/photos/${photo.id}`, {
      method: 'PATCH',
      body: { label }
    })

    toast.add({
      title: 'Alias renommé',
      description: 'La photo a été mise à jour.',
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
    savingPhotoId.value = ''
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <p class="font-medium text-highlighted">
        Photos importées
      </p>
      <UBadge
        color="neutral"
        variant="subtle"
      >
        {{ props.photos.length }}
      </UBadge>
    </div>

    <div
      v-if="photos.length"
      class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6"
    >
      <figure
        v-for="photo in photos"
        :key="photo.id"
        class="overflow-hidden rounded-lg border border-default bg-default"
      >
        <NuxtImg
          :src="photo.url"
          :alt="photo.label"
          class="aspect-square w-full object-cover"
        />
        <figcaption class="space-y-2 p-2">
          <form
            v-if="editingPhotoId === photo.id"
            class="space-y-2"
            @submit.prevent="renamePhoto(photo)"
          >
            <input
              v-model="aliasDraft"
              class="h-9 w-full rounded-md border border-default bg-default px-2 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
              maxlength="80"
              aria-label="Alias de la photo"
            >
            <div class="flex gap-1">
              <UButton
                type="submit"
                size="xs"
                icon="i-lucide-check"
                :loading="savingPhotoId === photo.id"
              >
                Sauver
              </UButton>
              <UButton
                type="button"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                :disabled="savingPhotoId === photo.id"
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
            <span class="min-w-0 flex-1 truncate text-xs text-muted">
              {{ photo.label }}
            </span>
            <UButton
              :aria-label="`Renommer ${photo.label}`"
              :title="`Renommer ${photo.label}`"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              square
              @click="startRenaming(photo)"
            />
          </div>
        </figcaption>
      </figure>
    </div>

    <UAlert
      v-else
      color="neutral"
      variant="subtle"
      icon="i-lucide-images"
      title="Aucune photo"
      description="Ajoutez plusieurs visages pour obtenir des figures et atouts plus variés."
    />
  </div>
</template>
