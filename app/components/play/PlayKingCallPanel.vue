<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'
import { callableCards } from '~~/shared/tarot'

const props = defineProps<{
  hand: CardId[]
  faceUrlFor: (card: CardId) => string | null
}>()

/* Kings, plus queens with the 4 kings, etc. (FFT). */
const options = computed(() => callableCards(props.hand))

const emit = defineEmits<{
  call: [king: CardId]
}>()

const RANKS: Record<string, string> = { k: 'Roi', q: 'Dame', c: 'Cavalier', j: 'Valet' }
const SUITS: Record<string, string> = { hearts: 'cœur', diamonds: 'carreau', clubs: 'trèfle', spades: 'pique' }

function label(card: CardId) {
  const [suit, rank] = card.split('-')
  return `${RANKS[rank ?? ''] ?? ''} de ${SUITS[suit ?? ''] ?? ''}`
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
        v-for="king in options"
        :key="king"
        type="button"
        class="group flex flex-col items-center gap-1.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        @click="emit('call', king)"
      >
        <span class="transition-transform duration-150 group-hover:-translate-y-1.5">
          <PlayDeckCard
            :card-id="king"
            :face-url="faceUrlFor(king)"
            size="md"
          />
        </span>
        <span class="text-xs text-white/70 group-hover:text-white">{{ label(king) }}</span>
      </button>
    </div>
  </PlayPanel>
</template>
