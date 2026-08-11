<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'
import { tarotCardLabel } from '~/utils/tarotCardLabel'

const props = defineProps<{
  cards: CardId[]
  legalMoves: CardId[]
  faceUrls: Map<string, string | null> | Record<string, string | null>
  backUrl?: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  play: [card: CardId]
}>()

const hovered = shallowRef(false)
const legalSet = computed(() => new Set(props.legalMoves))

function faceUrlFor(card: CardId): string | null {
  const urls = props.faceUrls
  if (urls instanceof Map) {
    return urls.get(card) ?? null
  }
  return urls[card] ?? null
}

function labelFor(card: CardId) {
  return tarotCardLabel(card)
}

/** ExempleCards-style arc: pivot at bottom, spread on hover. */
function cardStyle(index: number, total: number): Record<string, string> {
  const mid = (total - 1) / 2
  const dist = index - mid
  const t = total <= 1 ? 0 : dist / Math.max(mid, 1)

  const arc = hovered.value ? 38 : 26
  const spread = hovered.value ? Math.min(560, 48 + total * 28) : Math.min(420, 36 + total * 22)
  const yOffset = hovered.value ? 36 : 18

  const rotate = t * arc
  const x = t * (spread / 2)
  const y = Math.abs(t) * yOffset
  const scale = hovered.value && Math.abs(dist) < 0.6 ? 1.04 : 1

  return {
    transform: `translateX(${x}px) translateY(${y}px) rotate(${rotate}deg) scale(${scale})`,
    zIndex: String(20 - Math.abs(dist)),
    transition: 'transform 420ms cubic-bezier(0.22, 1.2, 0.36, 1)',
  }
}

function onPlay(card: CardId) {
  if (props.disabled || !legalSet.value.has(card)) {
    return
  }
  emit('play', card)
}
</script>

<template>
  <div
    class="pointer-events-auto relative mx-auto flex h-[min(34vh,280px)] w-full max-w-4xl items-end justify-center pb-1"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <div class="relative h-[11.5rem] w-[7.5rem]">
      <button
        v-for="(card, index) in cards"
        :key="card"
        type="button"
        class="absolute inset-0 origin-bottom rounded-2xl border-2 shadow-[0_10px_28px_-8px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        :class="[
          legalSet.has(card) && !disabled
            ? 'cursor-pointer border-amber-200/50 hover:-translate-y-2'
            : 'cursor-not-allowed border-white/15 opacity-45 grayscale-[0.35]',
        ]"
        :style="cardStyle(index, cards.length)"
        :disabled="disabled || !legalSet.has(card)"
        :aria-label="legalSet.has(card) ? `Jouer ${labelFor(card).shortLabel}` : `${labelFor(card).shortLabel} (non jouable)`"
        @click="onPlay(card)"
      >
        <img
          v-if="faceUrlFor(card)"
          :src="faceUrlFor(card)!"
          :alt="labelFor(card).shortLabel"
          class="h-full w-full rounded-[0.9rem] object-cover"
          draggable="false"
        >
        <div
          v-else
          class="flex h-full w-full flex-col items-center justify-between rounded-[0.9rem] bg-[#f4efe6] px-2 py-2 text-[#1c1917]"
        >
          <span
            class="self-start text-sm font-bold"
            :class="labelFor(card).color === 'red' ? 'text-red-700' : labelFor(card).color === 'gold' ? 'text-amber-700' : 'text-stone-900'"
          >
            {{ labelFor(card).shortLabel }}
          </span>
          <span
            class="text-3xl font-bold"
            :class="labelFor(card).color === 'red' ? 'text-red-700' : labelFor(card).color === 'gold' ? 'text-amber-700' : 'text-stone-900'"
          >
            {{ labelFor(card).shortLabel.slice(0, 2) }}
          </span>
          <span class="self-end rotate-180 text-sm font-bold opacity-80">
            {{ labelFor(card).shortLabel }}
          </span>
        </div>
      </button>
    </div>
  </div>
</template>
