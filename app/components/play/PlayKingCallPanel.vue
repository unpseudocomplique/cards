<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'
import { KING_IDS } from '~~/shared/tarot'

defineProps<{
  faceUrlFor: (card: CardId) => string | null
}>()

const emit = defineEmits<{
  call: [king: CardId]
}>()

const labels: Record<string, string> = {
  'hearts-k': 'Roi de cœur',
  'diamonds-k': 'Roi de carreau',
  'clubs-k': 'Roi de trèfle',
  'spades-k': 'Roi de pique'
}
</script>

<template>
  <PlayPanel
    title="Appelez un roi"
    description="Le joueur qui le possède sera votre partenaire secret."
    icon="i-lucide-crown"
  >
    <div class="flex flex-wrap justify-center gap-3">
      <button
        v-for="king in KING_IDS"
        :key="king"
        type="button"
        class="group flex flex-col items-center gap-1.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        @click="emit('call', king as CardId)"
      >
        <span class="transition-transform duration-150 group-hover:-translate-y-1.5">
          <PlayDeckCard
            :card-id="king as CardId"
            :face-url="faceUrlFor(king as CardId)"
            size="md"
          />
        </span>
        <span class="text-xs text-white/70 group-hover:text-white">{{ labels[king] }}</span>
      </button>
    </div>
  </PlayPanel>
</template>
