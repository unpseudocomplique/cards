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

const statusLabels: Record<string, string> = {
  draft: 'En préparation',
  queued: 'En file',
  generating: 'Génération',
  ready: 'Terminé',
  failed: 'À reprendre'
}

const statusColor = computed(() => ({
  draft: 'neutral',
  queued: 'info',
  generating: 'warning',
  ready: 'success',
  failed: 'error'
} as const))
</script>

<template>
  <div>
    <header class="mb-8">
      <p class="text-xs tracking-[0.2em] text-primary uppercase">
        Vos jeux
      </p>
      <div class="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="font-serif text-3xl tracking-tight text-highlighted sm:text-4xl">
            Mes decks
          </h1>
          <p class="mt-2 max-w-[42ch] text-pretty text-muted">
            Retrouvez vos jeux et poursuivez leur génération.
          </p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <UButton
            to="/play"
            icon="i-lucide-spade"
            class="w-full justify-center sm:w-auto"
          >
            Jouer au tarot
          </UButton>
          <UButton
            to="/decks/new"
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            class="w-full justify-center sm:w-auto"
          >
            Nouveau deck
          </UButton>
        </div>
      </div>
    </header>

    <div
      v-if="pending"
      class="grid gap-3 sm:grid-cols-2"
    >
      <USkeleton
        v-for="item in 4"
        :key="item"
        class="h-36 rounded-2xl"
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
        class="min-w-0 rounded-2xl border border-default/80 bg-elevated/30 p-4 transition-colors hover:bg-elevated/60 active:scale-[0.99]"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate font-serif text-xl text-highlighted">
              {{ deck.title }}
            </h2>
            <p class="mt-1 line-clamp-2 text-sm text-muted">
              {{ deck.description || 'Deck sans description' }}
            </p>
          </div>
          <UBadge
            :color="statusColor[deck.status]"
            variant="subtle"
            class="shrink-0"
          >
            {{ statusLabels[deck.status] || deck.status }}
          </UBadge>
        </div>
        <div class="mt-4 flex items-center justify-between gap-3 text-sm tabular-nums text-muted">
          <span>{{ deck.cardCount }} cartes</span>
          <span>{{ deck.readyCardCount }} prêtes</span>
        </div>
      </NuxtLink>
    </div>

    <div
      v-else
      class="rounded-2xl border border-dashed border-default px-5 py-10 text-center"
    >
      <p class="font-serif text-2xl text-highlighted">
        Aucun deck pour le moment
      </p>
      <p class="mx-auto mt-2 max-w-[36ch] text-sm text-pretty text-muted">
        Créez votre premier jeu pour importer des photos et préparer les cartes.
      </p>
      <UButton
        class="mt-5"
        icon="i-lucide-plus"
        to="/decks/new"
      >
        Créer un deck
      </UButton>
    </div>

    <UButton
      class="mt-6 w-full justify-center sm:w-auto"
      color="neutral"
      variant="ghost"
      icon="i-lucide-refresh-cw"
      @click="refresh()"
    >
      Rafraîchir
    </UButton>
  </div>
</template>
