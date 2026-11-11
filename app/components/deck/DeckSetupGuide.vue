<script setup lang="ts">
/** Four-step checklist shown until every card of the deck is ready. */
const emit = defineEmits<{
  generate: []
}>()

const { deckId, persons, stats, deck, job, backOutdated } = useDeckWorkspace()

const assigned = computed(() => stats.value.total - stats.value.unassigned)

const steps = computed(() => [{
  title: 'Ajouter des personnes',
  detail: persons.value.length
    ? `${persons.value.length} personne${persons.value.length > 1 ? 's' : ''}`
    : 'Personne pour l’instant',
  done: persons.value.length > 0,
  action: { label: 'Ajouter', to: `/decks/${deckId.value}/personnes` }
}, {
  title: 'Distribuer les rôles',
  detail: `${assigned.value}/${stats.value.total} cartes attribuées`,
  done: stats.value.unassigned === 0,
  action: { label: 'Répartir', to: `/decks/${deckId.value}/personnes#repartition` }
}, {
  title: 'Générer les cartes',
  detail: `${stats.value.ready}/${stats.value.total} prêtes`,
  done: stats.value.ready === stats.value.total,
  action: stats.value.generatable
    ? { label: `Générer ${stats.value.generatable}`, onClick: () => emit('generate') }
    : null
}, {
  title: 'Créer le dos',
  detail: backOutdated.value
    ? 'Dos à l’ancien format'
    : deck.value?.settings.cardBackImageUrl ? 'Dos prêt' : 'Pas encore de dos',
  done: Boolean(deck.value?.settings.cardBackImageUrl) && !backOutdated.value,
  action: { label: 'Ouvrir', to: `/decks/${deckId.value}/impression` }
}])

const current = computed(() => steps.value.findIndex(step => !step.done))
</script>

<template>
  <ol class="grid gap-px overflow-hidden rounded-xl bg-(--ui-border) ring ring-default sm:grid-cols-2 xl:grid-cols-4">
    <li
      v-for="(step, index) in steps"
      :key="step.title"
      class="flex items-center gap-3 bg-default p-3.5"
      :class="index === current ? 'bg-primary/5' : ''"
    >
      <span
        class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold"
        :class="step.done
          ? 'bg-success/15 text-success'
          : index === current ? 'bg-primary text-inverted' : 'bg-elevated text-muted'"
      >
        <UIcon
          v-if="step.done"
          name="i-lucide-check"
          class="size-4"
        />
        <template v-else>{{ index + 1 }}</template>
      </span>
      <div class="min-w-0 flex-1">
        <p
          class="truncate text-sm font-medium"
          :class="step.done ? 'text-muted line-through decoration-dimmed' : 'text-highlighted'"
        >
          {{ step.title }}
        </p>
        <p class="truncate text-xs text-muted">
          {{ step.detail }}
        </p>
      </div>
      <UButton
        v-if="step.action && index === current"
        :label="step.action.label"
        :to="'to' in step.action ? step.action.to : undefined"
        size="xs"
        :disabled="Boolean(job)"
        @click="'onClick' in step.action ? step.action.onClick?.() : undefined"
      />
    </li>
  </ol>
</template>
