<script setup lang="ts">
import type { DeckPerson, DeckPhoto } from '~/types/deck'

/** Server-side cap (server/utils/deckPersons.ts). */
const MAX_PHOTOS_PER_PERSON = 6

const props = defineProps<{
  deckId: string
  /** Existing person to add photos to; omit to create a new person. */
  person?: DeckPerson | null
}>()

const emit = defineEmits<{
  uploaded: [personId: string | null]
}>()

const open = defineModel<boolean>('open', { required: true })

const toast = useToast()
const { processImage, formatFileSize } = useImageCompression()

const name = shallowRef('')
const files = shallowRef<File[]>([])
const uploading = shallowRef(false)
const done = shallowRef(0)

const remaining = computed(() => MAX_PHOTOS_PER_PERSON - (props.person?.photos.length ?? 0))
const tooMany = computed(() => files.value.length > remaining.value)
const totalSize = computed(() => files.value.reduce((sum, file) => sum + file.size, 0))
const canSubmit = computed(() =>
  files.value.length > 0
  && !tooMany.value
  && (props.person || name.value.trim().length > 0)
)

watch(open, (value) => {
  if (value) {
    name.value = ''
    files.value = []
    done.value = 0
  }
})

async function upload() {
  if (!canSubmit.value) {
    return
  }

  uploading.value = true
  done.value = 0
  let personId = props.person?.id ?? null
  let failed = 0

  for (const file of files.value) {
    try {
      const processed = await processImage(file)
      if (!processed) {
        failed += 1
        continue
      }

      const form = new FormData()
      form.append('file', processed)
      form.append('label', file.name.replace(/\.[^/.]+$/, ''))
      if (personId) {
        form.append('personId', personId)
      } else {
        form.append('personLabel', name.value.trim())
      }

      const photo = await $fetch<DeckPhoto & { person?: { id: string } }>(`/api/decks/${props.deckId}/photos`, {
        method: 'POST',
        body: form
      })
      personId ??= photo.person?.id ?? photo.personId
      done.value += 1
    } catch (err) {
      failed += 1
      toast.add({
        title: `Import impossible : ${file.name}`,
        description: getApiErrorMessage(err),
        color: 'error',
        icon: 'i-lucide-circle-alert'
      })
    }
  }

  uploading.value = false

  if (done.value) {
    toast.add({
      title: props.person ? 'Photos ajoutées' : 'Personne ajoutée',
      description: `${done.value} photo${done.value > 1 ? 's' : ''} importée${done.value > 1 ? 's' : ''}${failed ? `, ${failed} en échec` : ''}.`,
      color: failed ? 'warning' : 'success',
      icon: 'i-lucide-check'
    })
    emit('uploaded', personId)
    open.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="person ? `Photos de ${person.label}` : 'Ajouter une personne'"
    :description="person
      ? `Encore ${remaining} photo${remaining > 1 ? 's' : ''} possible${remaining > 1 ? 's' : ''}.`
      : 'Plusieurs angles et expressions aident à garder la ressemblance.'"
    :dismissible="!uploading"
    :ui="{ body: 'space-y-4', footer: 'justify-between' }"
  >
    <template #body>
      <UFormField
        v-if="!person"
        label="Nom"
        required
      >
        <UInput
          v-model="name"
          placeholder="Marie, Papi Jean…"
          :maxlength="80"
          autofocus
          class="w-full"
          :disabled="uploading"
        />
      </UFormField>

      <UFileUpload
        v-model="files"
        multiple
        accept="image/jpeg,image/png,image/webp"
        icon="i-lucide-image-plus"
        label="Déposez les photos ici"
        :description="`JPG, PNG ou WebP · ${remaining} maximum · compressées avant l’envoi`"
        layout="grid"
        :disabled="uploading"
        :interactive="!uploading"
        class="w-full"
        :ui="{ base: 'min-h-40' }"
      />

      <UAlert
        v-if="tooMany"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`${remaining} photo${remaining > 1 ? 's' : ''} maximum pour cette personne`"
        description="Retirez quelques fichiers avant d’importer."
      />

      <div
        v-if="uploading"
        class="space-y-2"
      >
        <UProgress
          :model-value="done"
          :max="files.length"
        />
        <p class="text-xs text-muted tabular-nums">
          {{ done }}/{{ files.length }} importée{{ done > 1 ? 's' : '' }}…
        </p>
      </div>
    </template>

    <template #footer>
      <span class="text-xs text-muted">
        <template v-if="files.length">{{ files.length }} fichier{{ files.length > 1 ? 's' : '' }} · {{ formatFileSize(totalSize) }}</template>
      </span>
      <div class="flex gap-2">
        <UButton
          label="Annuler"
          color="neutral"
          variant="ghost"
          :disabled="uploading"
          @click="open = false"
        />
        <UButton
          :label="files.length ? `Importer ${files.length}` : 'Importer'"
          icon="i-lucide-upload"
          :loading="uploading"
          :disabled="!canSubmit"
          @click="upload"
        />
      </div>
    </template>
  </UModal>
</template>
