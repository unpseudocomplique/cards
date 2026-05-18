<script setup lang="ts">
import type { DeckCard } from '~/types/deck'

const props = defineProps<{
  cards: DeckCard[]
}>()

const statusColor = computed(() => ({
  pending: 'neutral',
  queued: 'info',
  generating: 'warning',
  ready: 'success',
  failed: 'error'
} as const))

const readyCount = computed(() => props.cards.filter(card => card.status === 'ready').length)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="font-medium text-highlighted">
          Cartes
        </p>
        <p class="text-sm text-muted">
          {{ readyCount }} / {{ cards.length }} prêtes
        </p>
      </div>
      <UBadge
        color="neutral"
        variant="subtle"
      >
        {{ cards.length }} cartes
      </UBadge>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <article
        v-for="card in cards"
        :key="card.id"
        class="overflow-hidden rounded-lg border border-default bg-default"
      >
        <div class="aspect-[3/4] bg-muted">
          <NuxtImg
            v-if="card.finalImageUrl"
            :src="card.finalImageUrl"
            :alt="card.metadata.label"
            class="size-full object-cover"
          />
          <div
            v-else
            class="flex size-full flex-col items-center justify-center gap-2 p-3 text-center"
          >
            <UIcon
              name="i-lucide-image"
              class="size-6 text-muted"
            />
            <span class="text-xs text-muted">En attente</span>
          </div>
        </div>
        <div class="space-y-2 p-3">
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-medium leading-snug text-highlighted">
              {{ card.metadata.label }}
            </p>
            <span class="text-sm font-bold text-muted">{{ card.metadata.shortLabel }}</span>
          </div>
          <UBadge
            :color="statusColor[card.status]"
            variant="subtle"
          >
            {{ card.status }}
          </UBadge>
        </div>
      </article>
    </div>
  </div>
</template>
