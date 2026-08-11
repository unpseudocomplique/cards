<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'

const props = defineProps<{
  cards: CardId[]
  legalMoves: CardId[]
}>()

const emit = defineEmits<{
  play: [card: CardId]
}>()

const legalSet = computed(() => new Set(props.legalMoves))

function isPlayable(card: CardId) {
  return legalSet.value.has(card)
}
</script>

<template>
  <div class="flex flex-wrap justify-center gap-2">
    <button
      v-for="card in cards"
      :key="card"
      type="button"
      class="rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      :class="isPlayable(card)
        ? 'cursor-pointer hover:-translate-y-1 hover:shadow-md'
        : 'cursor-not-allowed opacity-45'"
      :disabled="!isPlayable(card)"
      :aria-label="isPlayable(card) ? `Jouer ${card}` : `${card} (non jouable)`"
      @click="isPlayable(card) && emit('play', card)"
    >
      <PlayCardFace :card-id="card" />
    </button>
  </div>
</template>
