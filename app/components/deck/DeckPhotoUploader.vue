<script setup lang="ts">
import type { DeckPerson, DeckPhoto } from '~/types/deck'

const props = defineProps<{
  deckId: string
  persons: DeckPerson[]
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
const personMode = shallowRef<'new' | 'existing'>('new')
const newPersonLabel = shallowRef('')
const selectedPersonId = shallowRef('')

const selectedFilesSize = computed(() => selectedFiles.value.reduce((total, file) => total + file.size, 0))
const personOptions = computed(() => props.persons.map(person => ({
  value: person.id,
  label: `${person.label} (${person.photos.length} photo${person.photos.length > 1 ? 's' : ''})`
})))
const uploadProgressLabel = computed(() => {
  if (!isUploading.value) {
    return ''
  }

  return `${uploadedCount.value} / ${selectedFiles.value.length} importée(s)`
})

watch(() => props.persons, (persons) => {
  if (!persons.length) {
    personMode.value = 'new'
    selectedPersonId.value = ''
    return
  }

  if (personMode.value === 'existing' && !persons.some(person => person.id === selectedPersonId.value)) {
    selectedPersonId.value = persons[0]?.id || ''
  }
}, { immediate: true })

async function uploadPhoto(file: File, options: { personId?: string | null, personLabel?: string }) {
  const processed = await processImage(file)

  if (!processed) {
    return null
  }

  const formData = new FormData()
  formData.append('file', processed)
  formData.append('label', file.name.replace(/\.[^/.]+$/, ''))

  if (options.personId) {
    formData.append('personId', options.personId)
  } else if (options.personLabel) {
    formData.append('personLabel', options.personLabel)
  }

  return $fetch<DeckPhoto & { person?: { id: string, label: string } }>(`/api/decks/${props.deckId}/photos`, {
    method: 'POST',
    body: formData
  })
}

async function uploadPhotos() {
  const files = [...selectedFiles.value]

  if (!files.length) {
    return
  }

  if (personMode.value === 'existing' && !selectedPersonId.value) {
    toast.add({
      title: 'Personne manquante',
      description: 'Choisissez la personne à laquelle ajouter ces photos.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  const batchPersonLabel = newPersonLabel.value.trim()
    || files[0]?.name.replace(/\.[^/.]+$/, '')
    || 'Personne'

  isUploading.value = true
  uploadedCount.value = 0
  failedCount.value = 0
  const uploadedPhotos: DeckPhoto[] = []
  let batchPersonId = personMode.value === 'existing' ? selectedPersonId.value : null

  for (const file of files) {
    try {
      const photo = await uploadPhoto(file, {
        personId: batchPersonId,
        personLabel: batchPersonId ? undefined : batchPersonLabel
      })

      if (!photo) {
        failedCount.value += 1
        continue
      }

      if (!batchPersonId && photo.person?.id) {
        batchPersonId = photo.person.id
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
      description: `${uploadedPhotos.length} photo(s) importée(s) pour la même personne.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
    selectedFiles.value = []
    newPersonLabel.value = ''

    if (batchPersonId) {
      personMode.value = 'existing'
      selectedPersonId.value = batchPersonId
    }
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
  }

  if (!selectedFiles.value.length) {
    isUploading.value = false
  }
}

watch(selectedFiles, resetUploadingState)
</script>

<template>
  <div class="rounded-xl border border-default bg-default p-4">
    <div class="space-y-4">
      <div>
        <p class="font-medium text-highlighted">
          Ajouter des photos
        </p>
        <p class="text-sm text-muted">
          Plusieurs angles de la même personne aident à mieux la reconnaître (6 photos max par personne).
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="Pour qui ?">
          <select
            v-model="personMode"
            class="h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
            :disabled="isUploading"
          >
            <option value="new">
              Une nouvelle personne
            </option>
            <option
              value="existing"
              :disabled="!persons.length"
            >
              Quelqu’un déjà ajouté
            </option>
          </select>
        </UFormField>

        <UFormField
          v-if="personMode === 'new'"
          label="Nom de la personne"
        >
          <input
            v-model="newPersonLabel"
            class="h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
            maxlength="80"
            placeholder="Ex. Marie"
            :disabled="isUploading"
          >
        </UFormField>

        <UFormField
          v-else
          label="Personne"
        >
          <select
            v-model="selectedPersonId"
            class="h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none focus:ring-2 focus:ring-primary"
            :disabled="isUploading || !personOptions.length"
          >
            <option value="">
              Choisir…
            </option>
            <option
              v-for="person in personOptions"
              :key="person.value"
              :value="person.value"
            >
              {{ person.label }}
            </option>
          </select>
        </UFormField>
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
        :ui="{ base: 'min-h-36 sm:min-h-44' }"
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
              class="w-full justify-center sm:w-auto"
              icon="i-lucide-plus"
              :disabled="isUploading"
              @click="open()"
            >
              Ajouter
            </UButton>
          </div>
        </template>
      </UFileUpload>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-muted">
          {{ uploadProgressLabel || 'Toutes les photos du lot seront liées à la même personne.' }}
        </p>
        <div class="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
          <UButton
            color="neutral"
            variant="ghost"
            class="w-full justify-center"
            icon="i-lucide-x"
            :disabled="!selectedFiles.length || isUploading"
            @click="clearFiles"
          >
            Vider
          </UButton>
          <UButton
            class="w-full justify-center"
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
