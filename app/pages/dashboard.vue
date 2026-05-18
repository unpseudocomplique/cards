<script setup lang="ts">
import type { DeckSummary } from '~/types/deck'

definePageMeta({
  middleware: 'auth'
})

useSeoMeta({
  title: 'Dashboard'
})

const requestFetch = useRequestFetch()
const { data: decks, pending, refresh } = await useAsyncData(
  'decks',
  () => requestFetch<DeckSummary[]>('/api/decks'),
  {
    default: () => []
  }
)

const statusColor = computed(() => ({
  draft: 'neutral',
  queued: 'info',
  generating: 'warning',
  ready: 'success',
  failed: 'error'
} as const))
</script>

<template>
  <UPage>
    <UPageHeader
      title="Mes decks"
      description="Retrouvez vos jeux sauvegardés et poursuivez leur génération."
      :links="[{ label: 'Nouveau deck', icon: 'i-lucide-plus', to: '/decks/new' }]"
    />

    <UPageSection :ui="{ container: 'pt-0' }">
      <div
        v-if="pending"
        class="grid gap-3 sm:grid-cols-2"
      >
        <USkeleton
          v-for="item in 4"
          :key="item"
          class="h-36 rounded-lg"
        />
      </div>

      <div
        v-else-if="decks?.length"
        class="grid gap-3 sm:grid-cols-2"
      >
        <NuxtLink
          v-for="deck in decks"
          :key="deck.id"
          :to="`/decks/${deck.id}`"
          class="rounded-lg border border-default bg-default p-4 transition hover:bg-muted/60"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="font-semibold text-highlighted">
                {{ deck.title }}
              </h2>
              <p class="mt-1 line-clamp-2 text-sm text-muted">
                {{ deck.description || 'Deck sans description' }}
              </p>
            </div>
            <UBadge
              :color="statusColor[deck.status]"
              variant="subtle"
            >
              {{ deck.status }}
            </UBadge>
          </div>
          <div class="mt-4 flex items-center justify-between text-sm text-muted">
            <span>{{ deck.cardCount }} cartes</span>
            <span>{{ deck.readyCardCount }} prêtes</span>
          </div>
        </NuxtLink>
      </div>

      <UAlert
        v-else
        color="neutral"
        variant="subtle"
        icon="i-lucide-layers"
        title="Aucun deck pour le moment"
        description="Créez votre premier jeu pour importer des photos et préparer les cartes."
        :actions="[{ label: 'Créer un deck', icon: 'i-lucide-plus', to: '/decks/new' }]"
      />

      <UButton
        class="mt-6"
        color="neutral"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        @click="refresh()"
      >
        Rafraîchir
      </UButton>
    </UPageSection>
  </UPage>
</template>
