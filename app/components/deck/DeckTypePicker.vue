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
    description: 'Tarot 56 cartes avec Atouts 1 à 21 et Excuse.',
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
      class="rounded-lg border p-4 text-left transition hover:bg-muted/60"
      :class="model === option.value ? 'border-primary bg-primary/10' : 'border-default bg-default'"
      @click="model = option.value"
    >
      <span class="flex items-center justify-between gap-3">
        <span class="font-semibold text-highlighted">{{ option.label }}</span>
        <UBadge
          color="neutral"
          variant="subtle"
        >
          {{ option.cards }}
        </UBadge>
      </span>
      <span class="mt-2 block text-sm text-muted">{{ option.description }}</span>
    </button>
  </div>
</template>
