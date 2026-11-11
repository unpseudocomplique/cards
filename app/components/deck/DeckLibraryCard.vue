<script setup lang="ts">
import type { DeckSummary } from '~/types/deck'
import { deckStatusMeta, deckTypeLabels } from '~/utils/deckLabels'
import { formatRelative } from '~/utils/format'

const props = defineProps<{
  deck: DeckSummary
}>()

const percent = computed(() => props.deck.cardCount
  ? Math.round((props.deck.readyCardCount / props.deck.cardCount) * 100)
  : 0)
const status = computed(() => deckStatusMeta[props.deck.status] ?? deckStatusMeta.draft)
const playable = computed(() => props.deck.type === 'tarot78')
</script>

<template>
  <article class="group relative flex flex-col overflow-hidden rounded-xl bg-default ring ring-default transition hover:ring-accented hover:shadow-lg hover:shadow-black/5">
    <DeckCover
      :urls="deck.coverUrls"
      :theme-id="deck.settings?.colorTheme"
      :format-id="deck.settings?.cardFormat"
      class="h-44 bg-elevated/50"
    />

    <div class="flex flex-1 flex-col gap-3 p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="truncate font-semibold text-highlighted">
            <NuxtLink
              :to="`/decks/${deck.id}`"
              class="outline-none after:absolute after:inset-0 focus-visible:underline"
            >
              {{ deck.title }}
            </NuxtLink>
          </h2>
          <p class="mt-0.5 text-xs text-muted">
            {{ deckTypeLabels[deck.type] }} · modifié {{ formatRelative(deck.updatedAt) }}
          </p>
        </div>
        <UBadge
          :label="status.label"
          :color="status.color"
          variant="subtle"
          size="sm"
          class="shrink-0"
        />
      </div>

      <div class="mt-auto flex items-center gap-3">
        <UProgress
          :model-value="percent"
          size="xs"
          :color="percent === 100 ? 'success' : 'primary'"
          class="flex-1"
        />
        <span class="shrink-0 text-xs text-muted tabular-nums">
          {{ deck.readyCardCount }}/{{ deck.cardCount }}
        </span>
      </div>
    </div>

    <UTooltip
      v-if="playable"
      text="Jouer avec ce deck"
    >
      <UButton
        :to="{ path: '/play', query: { deck: deck.id } }"
        icon="i-lucide-spade"
        color="neutral"
        variant="solid"
        size="sm"
        square
        class="absolute top-3 right-3 z-10 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100"
        aria-label="Jouer avec ce deck"
      />
    </UTooltip>
  </article>
</template>
