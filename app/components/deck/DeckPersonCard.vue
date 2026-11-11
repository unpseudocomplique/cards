<script setup lang="ts">
import type { DeckPerson } from '~/types/deck'

const props = defineProps<{
  person: DeckPerson
  cardCount: number
}>()

const emit = defineEmits<{
  edit: []
  addPhotos: []
}>()

const cover = computed(() => props.person.photos[0] ?? null)
const thumbs = computed(() => props.person.photos.slice(1, 6))
const full = computed(() => props.person.photos.length >= 6)
</script>

<template>
  <article class="group relative overflow-hidden rounded-xl bg-default ring ring-default transition hover:ring-accented">
    <div class="relative aspect-[4/3] bg-elevated">
      <img
        v-if="cover"
        :src="cover.url"
        :alt="person.label"
        class="size-full object-cover"
        loading="lazy"
      >
      <div
        v-else
        class="grid size-full place-items-center text-dimmed"
      >
        <UIcon
          name="i-lucide-image-off"
          class="size-8"
        />
      </div>
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
    </div>

    <div class="flex items-center gap-2 p-3">
      <div class="min-w-0 flex-1">
        <!-- The whole card opens the editor (stretched link pattern). -->
        <button
          type="button"
          class="block w-full truncate text-left font-medium text-highlighted outline-none after:absolute after:inset-0 focus-visible:underline"
          :aria-label="`Modifier ${person.label}`"
          @click="emit('edit')"
        >
          {{ person.label }}
        </button>
        <p class="text-xs text-muted">
          <span :class="person.photos.length ? '' : 'text-warning'">
            {{ person.photos.length }} photo{{ person.photos.length > 1 ? 's' : '' }}
          </span>
          ·
          <span :class="cardCount ? '' : 'text-warning'">
            {{ cardCount ? `${cardCount} carte${cardCount > 1 ? 's' : ''}` : 'aucune carte' }}
          </span>
        </p>
      </div>
      <UIcon
        name="i-lucide-pencil"
        class="size-4 shrink-0 text-dimmed transition group-hover:text-default"
        aria-hidden="true"
      />
    </div>

    <UButton
      v-if="!full"
      icon="i-lucide-image-plus"
      size="xs"
      color="neutral"
      variant="solid"
      label="Photos"
      class="absolute top-2 right-2 z-10 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100"
      @click="emit('addPhotos')"
    />
  </article>
</template>
