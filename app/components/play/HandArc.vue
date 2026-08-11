<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'
import { tarotCardLabel } from '~/utils/tarotCardLabel'

const props = defineProps<{
  cards: CardId[]
  legalMoves: CardId[]
  faceUrls: Map<string, string | null> | Record<string, string | null>
  backUrl?: string | null
  /** When true, non-legal cards are dimmed (Trick only). */
  dimUnplayable?: boolean
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

function isPlayable(card: CardId) {
  return !props.disabled && legalSet.value.has(card)
}

function shouldDim(card: CardId) {
  return !!props.dimUnplayable && !isPlayable(card)
}

/** ExempleCards-style arc: pivot at bottom, spread on hover. */
function cardStyle(index: number, total: number): Record<string, string> {
  const mid = (total - 1) / 2
  const dist = index - mid
  const t = total <= 1 ? 0 : dist / Math.max(mid, 1)

  const arc = hovered.value ? 32 : 20
  const spread = hovered.value
    ? Math.min(1180, 120 + total * 52)
    : Math.min(980, 90 + total * 46)
  const yOffset = hovered.value ? 22 : 10

  const rotate = t * arc
  const x = t * (spread / 2)
  const y = Math.abs(t) * yOffset
  const playableBoost = props.dimUnplayable && isPlayable(props.cards[index]!) ? -16 : 0
  const scale = hovered.value && Math.abs(dist) < 0.75 ? 1.08 : 1

  return {
    transform: `translateX(${x}px) translateY(${y + playableBoost}px) rotate(${rotate}deg) scale(${scale})`,
    zIndex: String(40 - Math.abs(Math.round(dist * 2))),
    transition: 'transform 480ms cubic-bezier(0.22, 1.15, 0.36, 1), filter 200ms ease, opacity 200ms ease',
  }
}

function onPlay(card: CardId) {
  if (!isPlayable(card)) {
    return
  }
  emit('play', card)
}
</script>

<template>
  <div
    class="pointer-events-auto relative mx-auto flex h-[min(34vh,280px)] w-full max-w-6xl items-end justify-center overflow-visible pb-1"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <div class="relative mb-1 h-[9.25rem] w-[6.25rem]">
      <button
        v-for="(card, index) in cards"
        :key="card"
        type="button"
        class="absolute inset-0 origin-bottom overflow-hidden rounded-xl border border-stone-300/80 bg-[#f7f1e6] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        :class="[
          shouldDim(card)
            ? 'cursor-default brightness-[0.78] contrast-75'
            : isPlayable(card)
              ? 'cursor-pointer border-amber-300 ring-2 ring-amber-300/60 -translate-y-1'
              : 'cursor-default',
        ]"
        :style="cardStyle(index, cards.length)"
        :disabled="!isPlayable(card)"
        :aria-label="isPlayable(card) ? `Jouer ${labelFor(card).shortLabel}` : labelFor(card).shortLabel"
        @click="onPlay(card)"
      >
        <img
          v-if="faceUrlFor(card)"
          :src="faceUrlFor(card)!"
          :alt="labelFor(card).shortLabel"
          class="h-full w-full rounded-[0.85rem] object-cover"
          draggable="false"
        >
        <div
          v-else
          class="flex h-full w-full flex-col justify-between rounded-[0.65rem] bg-[#f7f1e6] px-1.5 py-1.5"
        >
          <div
            class="text-left text-[0.8rem] leading-none font-bold"
            :class="labelFor(card).color === 'red' ? 'text-red-700' : labelFor(card).color === 'gold' ? 'text-amber-800' : 'text-stone-900'"
          >
            {{ labelFor(card).shortLabel }}
          </div>
          <div
            class="text-center text-3xl leading-none font-bold"
            :class="labelFor(card).color === 'red' ? 'text-red-700' : labelFor(card).color === 'gold' ? 'text-amber-800' : 'text-stone-900'"
          >
            {{ labelFor(card).shortLabel.slice(-1).match(/[♥♦♣♠]/) ? labelFor(card).shortLabel.slice(-1) : labelFor(card).shortLabel.replace(/[♥♦♣♠]/g, '').slice(0, 2) }}
          </div>
          <div
            class="self-end rotate-180 text-left text-[0.8rem] leading-none font-bold"
            :class="labelFor(card).color === 'red' ? 'text-red-700' : labelFor(card).color === 'gold' ? 'text-amber-800' : 'text-stone-900'"
          >
            {{ labelFor(card).shortLabel }}
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
