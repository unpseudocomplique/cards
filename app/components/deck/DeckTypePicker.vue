<script setup lang="ts">
import type { DeckType } from '~/types/deck'

const model = defineModel<DeckType>({ required: true })

const options: Array<{ value: DeckType, label: string, description: string, cards: number }> = [
  {
    value: 'classic52',
    label: 'Classique 52 cartes',
    description: 'As, valeurs, Valets, Dames et Rois sur 4 enseignes.',
    cards: 52
  },
  {
    value: 'tarot56',
    label: 'Tarot enseignes',
    description: 'Ajoute les Cavaliers aux figures de chaque enseigne.',
    cards: 56
  },
  {
    value: 'tarot78',
    label: 'Tarot complet',
    description: 'Tarot 56 cartes plus les arcanes majeurs 1–21 (Le Bateleur au Monde) et l\'Excuse (Le Mat).',
    cards: 78
  }
]
</script>

<template>
  <div class="grid gap-3 md:grid-cols-3">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="rounded-xl border p-4 text-left transition hover:bg-muted/60"
      :class="model === option.value ? 'border-primary bg-primary/10' : 'border-default bg-default'"
      @click="model = option.value"
    >
      <span class="flex items-start justify-between gap-3">
        <span class="min-w-0 font-semibold text-highlighted">{{ option.label }}</span>
        <UBadge
          color="neutral"
          variant="subtle"
          class="shrink-0"
        >
          {{ option.cards }}
        </UBadge>
      </span>
      <span class="mt-2 block text-sm text-pretty text-muted">{{ option.description }}</span>
    </button>
  </div>
</template>
