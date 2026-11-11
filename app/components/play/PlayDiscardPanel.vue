<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'
import { isOudler, isTrump, sortHand, validateEcart } from '~~/shared/tarot'

const props = defineProps<{
  hand: CardId[]
  size: 3 | 6
  faceUrlFor: (card: CardId) => string | null
}>()

const emit = defineEmits<{
  discard: [cards: CardId[]]
}>()

const selected = shallowRef<CardId[]>([])
const sorted = computed(() => sortHand(props.hand))

watch(() => props.hand, (hand) => {
  selected.value = selected.value.filter(card => hand.includes(card))
})

function forbidden(card: CardId) {
  return (card.endsWith('-k') && !isTrump(card)) || isOudler(card)
}

function toggle(card: CardId) {
  if (forbidden(card)) {
    return
  }
  const index = selected.value.indexOf(card)
  if (index >= 0) {
    selected.value = selected.value.filter(entry => entry !== card)
  } else if (selected.value.length < props.size) {
    selected.value = [...selected.value, card]
  }
}

const reasons: Record<string, string> = {
  'Cannot discard kings': 'Les rois ne vont jamais au chien.',
  'Cannot discard oudlers': 'Les bouts ne vont jamais au chien.',
  'Must discard all available non-trump, non-king cards before discarding trumps': 'Écartez d’abord vos cartes de couleur avant un atout.',
  'Trumps may only be discarded when there are not enough legal cards': 'Un atout ne s’écarte que faute d’autres cartes possibles.'
}

const validation = computed(() => {
  if (selected.value.length !== props.size) {
    return null
  }
  return validateEcart(props.hand, selected.value, props.size)
})

const error = computed(() => validation.value && !validation.value.ok
  ? reasons[validation.value.reason] ?? validation.value.reason
  : null)

const shownTrumps = computed(() => validation.value?.ok ? validation.value.shownTrumps.length : 0)
</script>

<template>
  <PlayPanel
    title="Votre écart"
    :description="`Choisissez ${size} cartes à mettre de côté. Elles compteront pour vous.`"
    icon="i-lucide-archive"
  >
    <template #aside>
      <span
        class="rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums"
        :class="selected.length === size ? 'bg-amber-300 text-neutral-950' : 'bg-white/10 text-white'"
      >
        {{ selected.length }}/{{ size }}
      </span>
    </template>

    <div class="flex max-h-[42vh] flex-wrap justify-center gap-1.5 overflow-y-auto p-1 sm:gap-2">
      <button
        v-for="card in sorted"
        :key="card"
        type="button"
        class="rounded-xl transition duration-150 outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        :class="[
          selected.includes(card) ? '-translate-y-2' : 'hover:-translate-y-1',
          forbidden(card) ? 'cursor-not-allowed opacity-35' : ''
        ]"
        :disabled="forbidden(card)"
        :aria-pressed="selected.includes(card)"
        @click="toggle(card)"
      >
        <PlayDeckCard
          :card-id="card"
          :face-url="faceUrlFor(card)"
          size="sm"
          :highlighted="selected.includes(card)"
        />
      </button>
    </div>

    <p
      v-if="error"
      class="mt-3 flex items-center gap-2 text-sm text-rose-300"
    >
      <UIcon
        name="i-lucide-circle-alert"
        class="size-4 shrink-0"
      />
      {{ error }}
    </p>
    <p
      v-else-if="shownTrumps"
      class="mt-3 text-sm text-white/60"
    >
      Les atouts écartés seront montrés aux autres joueurs.
    </p>

    <template #footer>
      <UButton
        v-if="selected.length"
        label="Tout retirer"
        color="neutral"
        variant="ghost"
        class="text-white/70 hover:bg-white/10"
        @click="selected = []"
      />
      <UButton
        label="Valider l’écart"
        icon="i-lucide-check"
        size="lg"
        :disabled="!validation?.ok"
        @click="emit('discard', selected)"
      />
    </template>
  </PlayPanel>
</template>
