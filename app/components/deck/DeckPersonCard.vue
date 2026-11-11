<script setup lang="ts">
import type { DeckPerson } from '~/types/deck'

const props = defineProps<{
  person: DeckPerson
  cardCount: number
}>()

const emit = defineEmits<{
  addPhotos: []
}>()

const toast = useToast()
const { deckId, refresh } = useDeckWorkspace()

const editing = shallowRef(false)
const draft = shallowRef('')
const saving = shallowRef(false)

const cover = computed(() => props.person.photos[0] ?? null)
const thumbs = computed(() => props.person.photos.slice(1, 6))
const full = computed(() => props.person.photos.length >= 6)

function startEdit() {
  draft.value = props.person.label
  editing.value = true
}

async function save() {
  const label = draft.value.trim()
  if (!label || label === props.person.label) {
    editing.value = false
    return
  }
  saving.value = true
  try {
    await $fetch(`/api/decks/${deckId.value}/persons/${props.person.id}`, {
      method: 'PATCH',
      body: { label }
    })
    await refresh()
    editing.value = false
  } catch (err) {
    toast.add({ title: 'Renommage impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <article class="group overflow-hidden rounded-xl bg-default ring ring-default">
    <div class="relative aspect-[4/3] bg-elevated">
      <img
        v-if="cover"
        :src="cover.url"
        :alt="person.label"
        class="size-full object-cover"
        loading="lazy"
      >
      <div
        v-if="thumbs.length"
        class="absolute inset-x-2 bottom-2 flex gap-1"
      >
        <img
          v-for="photo in thumbs"
          :key="photo.id"
          :src="photo.url"
          :alt="`${person.label} — ${photo.label}`"
          class="size-9 rounded-md object-cover ring-2 ring-white/80 shadow"
          loading="lazy"
        >
      </div>
      <UButton
        v-if="!full"
        icon="i-lucide-image-plus"
        size="xs"
        color="neutral"
        variant="solid"
        class="absolute top-2 right-2 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100"
        label="Photos"
        @click="emit('addPhotos')"
      />
    </div>

    <div class="flex items-center gap-2 p-3">
      <form
        v-if="editing"
        class="flex flex-1 items-center gap-1"
        @submit.prevent="save"
      >
        <UInput
          v-model="draft"
          size="sm"
          :maxlength="80"
          autofocus
          class="flex-1"
          aria-label="Nom de la personne"
          @keydown.esc="editing = false"
        />
        <UButton
          type="submit"
          icon="i-lucide-check"
          size="sm"
          square
          :loading="saving"
          aria-label="Enregistrer"
        />
      </form>
      <template v-else>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-highlighted">
            {{ person.label }}
          </p>
          <p class="text-xs text-muted">
            {{ person.photos.length }} photo{{ person.photos.length > 1 ? 's' : '' }} ·
            <span :class="cardCount ? '' : 'text-warning'">
              {{ cardCount ? `${cardCount} carte${cardCount > 1 ? 's' : ''}` : 'aucune carte' }}
            </span>
          </p>
        </div>
        <UButton
          icon="i-lucide-pencil"
          size="sm"
          color="neutral"
          variant="ghost"
          square
          :aria-label="`Renommer ${person.label}`"
          @click="startEdit"
        />
      </template>
    </div>
  </article>
</template>
