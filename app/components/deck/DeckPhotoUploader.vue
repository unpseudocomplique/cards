<script setup lang="ts">
import type { DeckPhoto } from '~/types/deck'

const props = defineProps<{
  deckId: string
}>()

const emit = defineEmits<{
  uploaded: [photos: DeckPhoto[]]
}>()

const toast = useToast()
const { processImage, formatFileSize } = useImageCompression()
const isUploading = shallowRef(false)
const selectedFiles = shallowRef<File[]>([])
const uploadedCount = shallowRef(0)
const failedCount = shallowRef(0)

const selectedFilesSize = computed(() => selectedFiles.value.reduce((total, file) => total + file.size, 0))
const uploadProgressLabel = computed(() => {
  if (!isUploading.value) {
    return ''
  }

  return `${uploadedCount.value} / ${selectedFiles.value.length} importée(s)`
})

async function uploadPhoto(file: File) {
  const processed = await processImage(file)

  if (!processed) {
    return null
  }

  const formData = new FormData()
  formData.append('file', processed)
  formData.append('label', file.name.replace(/\.[^/.]+$/, ''))

  return $fetch<DeckPhoto>(`/api/decks/${props.deckId}/photos`, {
    method: 'POST',
    body: formData
  })
}

async function uploadPhotos() {
  const files = [...selectedFiles.value]

  if (!files.length) {
    return
  }

  isUploading.value = true
  uploadedCount.value = 0
  failedCount.value = 0
  const uploadedPhotos: DeckPhoto[] = []

  for (const file of files) {
    try {
      const photo = await uploadPhoto(file)

      if (!photo) {
        failedCount.value += 1
        continue
      }

      uploadedPhotos.push(photo)
      uploadedCount.value += 1
    } catch (error) {
      failedCount.value += 1
      toast.add({
        title: `Import impossible: ${file.name}`,
        description: error instanceof Error ? error.message : 'Veuillez réessayer.',
        color: 'error',
        icon: 'i-lucide-alert-circle'
      })
    }
  }

  if (uploadedPhotos.length) {
    emit('uploaded', uploadedPhotos)
    toast.add({
      title: uploadedPhotos.length > 1 ? 'Photos ajoutées' : 'Photo ajoutée',
      description: `${uploadedPhotos.length} photo(s) importée(s).`,
      color: 'success',
      icon: 'i-lucide-check'
    })
    selectedFiles.value = []
  }

  if (!uploadedPhotos.length && failedCount.value) {
    toast.add({
      title: 'Aucune photo importée',
      description: 'Tous les fichiers ont échoué.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  }

  if (uploadedPhotos.length && failedCount.value) {
    toast.add({
      title: 'Import partiel',
      description: `${failedCount.value} fichier(s) n'ont pas pu être importés.`,
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
  }

  isUploading.value = false
}

function clearFiles() {
  if (isUploading.value) {
    return
  }

  selectedFiles.value = []
  uploadedCount.value = 0
  failedCount.value = 0
}

function handleUploadClick() {
  void uploadPhotos()
}

function resetUploadingState() {
  if (!isUploading.value) {
    uploadedCount.value = 0
    failedCount.value = 0
    return
  }

  if (!selectedFiles.value.length) {
    isUploading.value = false
  }
}

watch(selectedFiles, resetUploadingState)
</script>

<template>
  <div class="rounded-lg border border-default bg-default p-4">
    <div class="space-y-4">
      <div>
        <p class="font-medium text-highlighted">
          Importer des photos
        </p>
        <p class="text-sm text-muted">
          JPEG, PNG ou WebP. Compression automatique avant envoi.
        </p>
      </div>

      <UFileUpload
        v-model="selectedFiles"
        multiple
        accept="image/jpeg,image/png,image/webp"
        icon="i-lucide-images"
        label="Déposez vos photos ici"
        description="Sélection multiple acceptée, 2 Mo max après compression."
        layout="list"
        position="inside"
        :disabled="isUploading"
        :interactive="!isUploading"
        :ui="{ base: 'min-h-44' }"
      >
        <template #files-top="{ open, files }">
          <div
            v-if="files?.length"
            class="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-sm font-medium text-highlighted">
              {{ files.length }} fichier(s) sélectionné(s)
              <span class="text-muted">({{ formatFileSize(selectedFilesSize) }})</span>
            </p>
            <UButton
              size="sm"
              color="neutral"
              variant="subtle"
              icon="i-lucide-plus"
              :disabled="isUploading"
              @click="open()"
            >
              Ajouter
            </UButton>
          </div>
        </template>
      </UFileUpload>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-muted">
          {{ uploadProgressLabel || 'Les alias seront créés depuis les noms de fichiers.' }}
        </p>
        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            :disabled="!selectedFiles.length || isUploading"
            @click="clearFiles"
          >
            Vider
          </UButton>
          <UButton
            icon="i-lucide-upload"
            :loading="isUploading"
            :disabled="!selectedFiles.length"
            @click="handleUploadClick"
          >
            Importer {{ selectedFiles.length || '' }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
