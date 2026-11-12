<script setup lang="ts">
import type { CardRolePromptKey, DeckPerson } from '~/types/deck'
import { cardRole, roleMeta } from '~/utils/deckLabels'

/** Server-side cap (server/utils/deckPersons.ts). */
const MAX_PHOTOS_PER_PERSON = 6

const props = defineProps<{
  person: DeckPerson | null
}>()

const emit = defineEmits<{
  addPhotos: [person: DeckPerson]
}>()

const open = defineModel<boolean>('open', { required: true })

const toast = useToast()
const { deckId, cards, refresh } = useDeckWorkspace()

/* Name */
const name = shallowRef('')
const savingName = shallowRef(false)
/** Photo awaiting a second click to be deleted. */
const confirmPhotoId = shallowRef<string | null>(null)

watch(() => [props.person?.id, open.value], () => {
  name.value = props.person?.label ?? ''
  confirmPhotoId.value = null
}, { immediate: true })

const nameDirty = computed(() => Boolean(props.person) && name.value.trim() !== props.person!.label && name.value.trim().length > 0)

async function saveName() {
  if (!props.person || !nameDirty.value) {
    return
  }
  savingName.value = true
  try {
    await $fetch(`/api/decks/${deckId.value}/persons/${props.person.id}`, {
      method: 'PATCH',
      body: { label: name.value.trim() }
    })
    await refresh()
    toast.add({ title: 'Nom enregistré', color: 'success', icon: 'i-lucide-check' })
  } catch (err) {
    toast.add({ title: 'Renommage impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    savingName.value = false
  }
}

/* Person prompt layer */
const promptDraft = shallowRef('')
const savingPrompt = shallowRef(false)

watch(() => [props.person?.id, props.person?.prompt, open.value], () => {
  promptDraft.value = props.person?.prompt ?? ''
}, { immediate: true })

const promptDirty = computed(() => Boolean(props.person) && (promptDraft.value.trim() || null) !== (props.person!.prompt ?? null))

async function savePrompt() {
  if (!props.person || !promptDirty.value) {
    return
  }
  savingPrompt.value = true
  try {
    await $fetch(`/api/decks/${deckId.value}/persons/${props.person.id}`, {
      method: 'PATCH',
      body: { prompt: promptDraft.value.trim() || null }
    })
    await refresh()
    toast.add({ title: 'Consigne enregistrée', description: 'Elle s’appliquera à ses prochaines cartes générées.', color: 'success', icon: 'i-lucide-check' })
  } catch (err) {
    toast.add({ title: 'Enregistrement impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    savingPrompt.value = false
  }
}

/* Assigned cards */
const assignedCards = computed(() => props.person
  ? cards.value.filter(card => card.sourcePersonId === props.person!.id)
  : [])

const assignedSummary = computed(() => {
  const counts = new Map<CardRolePromptKey, number>()
  for (const card of assignedCards.value) {
    const role = cardRole(card)
    counts.set(role, (counts.get(role) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([a], [b]) => roleMeta[a].order - roleMeta[b].order)
    .map(([role, count]) => `${count} ${count > 1 ? roleMeta[role].plural.toLowerCase() : roleMeta[role].singular.toLowerCase()}`)
    .join(', ')
})

/* Photos — two-step delete, no extra dialog */
const deletingPhotoId = shallowRef<string | null>(null)

async function deletePhoto(photoId: string) {
  if (confirmPhotoId.value !== photoId) {
    confirmPhotoId.value = photoId
    return
  }
  deletingPhotoId.value = photoId
  try {
    const result = await $fetch<{ remainingPhotos: number }>(`/api/decks/${deckId.value}/photos/${photoId}`, { method: 'DELETE' })
    await refresh()
    toast.add({
      title: 'Photo supprimée',
      description: result.remainingPhotos
        ? undefined
        : 'Cette personne n’a plus de photo : ajoutez-en avant de générer ses cartes.',
      color: result.remainingPhotos ? 'success' : 'warning',
      icon: result.remainingPhotos ? 'i-lucide-check' : 'i-lucide-triangle-alert'
    })
  } catch (err) {
    toast.add({ title: 'Suppression impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    deletingPhotoId.value = null
    confirmPhotoId.value = null
  }
}

/* Delete person */
const deleteOpen = shallowRef(false)
const deleteSummary = computed(() => {
  const photos = props.person?.photos.length ?? 0
  const cardsCount = assignedCards.value.length
  const photoPart = `${photos} photo${photos > 1 ? 's' : ''} supprimée${photos > 1 ? 's' : ''}`
  return cardsCount
    ? `${photoPart} et ${cardsCount} carte${cardsCount > 1 ? 's' : ''} à réattribuer.`
    : `${photoPart}.`
})
const deleting = shallowRef(false)

async function deletePerson() {
  if (!props.person) {
    return
  }
  const label = props.person.label
  deleting.value = true
  try {
    const result = await $fetch<{ unassignedCards: number }>(`/api/decks/${deckId.value}/persons/${props.person.id}`, { method: 'DELETE' })
    deleteOpen.value = false
    open.value = false
    await refresh()
    toast.add({
      title: 'Personne supprimée',
      description: result.unassignedCards
        ? `${label} · ${result.unassignedCards} carte${result.unassignedCards > 1 ? 's' : ''} sans personne à réattribuer.`
        : label,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (err) {
    toast.add({ title: 'Suppression impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="person ? `Modifier ${person.label}` : 'Personne'"
    description="Nom, photos de référence et cartes attribuées."
    :ui="{ content: 'max-w-md', body: 'space-y-8' }"
  >
    <template
      v-if="person"
      #body
    >
      <form
        class="flex items-end gap-2"
        @submit.prevent="saveName"
      >
        <UFormField
          label="Nom"
          class="flex-1"
        >
          <UInput
            v-model="name"
            :maxlength="80"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          label="Enregistrer"
          color="neutral"
          variant="subtle"
          :loading="savingName"
          :disabled="!nameDirty"
        />
      </form>

      <UFormField
        label="Consigne pour cette personne"
        help="S’applique à toutes ses cartes, après le style du jeu, de la couleur et du type. La consigne d’une carte peut la contredire."
      >
        <UTextarea
          v-model="promptDraft"
          :rows="3"
          autoresize
          :maxlength="1200"
          placeholder="Ex. ses chiens sont sur une des photos : ne les dessine pas, sauf si la carte le demande."
          class="w-full"
        />
        <div
          v-if="promptDirty"
          class="mt-2 flex justify-end gap-2"
        >
          <UButton
            label="Annuler"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="promptDraft = person.prompt ?? ''"
          />
          <UButton
            label="Enregistrer"
            size="xs"
            color="neutral"
            variant="subtle"
            :loading="savingPrompt"
            @click="savePrompt"
          />
        </div>
      </UFormField>

      <section>
        <div class="mb-3 flex items-center justify-between gap-2">
          <h3 class="text-sm font-medium text-highlighted">
            Photos de référence
            <span class="font-normal text-muted tabular-nums">· {{ person.photos.length }}/{{ MAX_PHOTOS_PER_PERSON }}</span>
          </h3>
          <UButton
            v-if="person.photos.length < MAX_PHOTOS_PER_PERSON"
            label="Ajouter"
            icon="i-lucide-image-plus"
            size="xs"
            color="neutral"
            variant="outline"
            @click="emit('addPhotos', person)"
          />
        </div>

        <UAlert
          v-if="!person.photos.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-image-off"
          title="Aucune photo"
          description="Ajoutez au moins une photo pour générer ses cartes."
        />

        <div
          v-else
          class="grid grid-cols-3 gap-2"
        >
          <div
            v-for="photo in person.photos"
            :key="photo.id"
            class="group relative aspect-square overflow-hidden rounded-lg bg-elevated"
          >
            <img
              :src="photo.url"
              :alt="`${person.label} — ${photo.label}`"
              class="size-full object-cover"
              :class="deletingPhotoId === photo.id ? 'opacity-40' : ''"
              loading="lazy"
            >
            <UButton
              :icon="confirmPhotoId === photo.id ? undefined : 'i-lucide-trash-2'"
              :label="confirmPhotoId === photo.id ? 'Supprimer ?' : undefined"
              size="xs"
              :color="confirmPhotoId === photo.id ? 'error' : 'neutral'"
              variant="solid"
              :square="confirmPhotoId !== photo.id"
              :loading="deletingPhotoId === photo.id"
              class="absolute top-1.5 right-1.5 shadow transition"
              :class="confirmPhotoId === photo.id ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100'"
              :aria-label="`Supprimer la photo ${photo.label}`"
              @click="deletePhoto(photo.id)"
              @blur="confirmPhotoId === photo.id && deletingPhotoId !== photo.id && (confirmPhotoId = null)"
            />
          </div>
        </div>
      </section>

      <section>
        <h3 class="mb-1 text-sm font-medium text-highlighted">
          Cartes attribuées
        </h3>
        <p class="text-sm text-muted">
          <template v-if="assignedCards.length">
            {{ assignedCards.length }} carte{{ assignedCards.length > 1 ? 's' : '' }} : {{ assignedSummary }}.
          </template>
          <template v-else>
            Aucune carte pour l’instant. Attribuez-la depuis la répartition par groupe ou depuis une carte.
          </template>
        </p>
      </section>

      <section class="rounded-xl p-4 ring ring-error/30">
        <h3 class="text-sm font-medium text-highlighted">
          Supprimer cette personne
        </h3>
        <p class="mt-1 text-sm text-muted">
          Ses photos sont supprimées et ses cartes n’ont plus de personne. Les cartes déjà générées gardent leur image.
        </p>
        <UButton
          label="Supprimer"
          icon="i-lucide-trash-2"
          color="error"
          variant="subtle"
          size="sm"
          class="mt-3"
          @click="deleteOpen = true"
        />
      </section>

      <UModal
        v-model:open="deleteOpen"
        :title="`Supprimer ${person.label} ?`"
        :ui="{ footer: 'justify-end' }"
      >
        <template #body>
          <p class="text-sm text-muted">
            {{ deleteSummary }} Les images déjà générées restent sur les cartes. Cette action est définitive.
          </p>
        </template>
        <template #footer>
          <UButton
            label="Annuler"
            color="neutral"
            variant="ghost"
            @click="deleteOpen = false"
          />
          <UButton
            label="Supprimer"
            icon="i-lucide-trash-2"
            color="error"
            :loading="deleting"
            @click="deletePerson"
          />
        </template>
      </UModal>
    </template>
  </USlideover>
</template>
