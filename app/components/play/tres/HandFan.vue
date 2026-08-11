<script setup lang="ts">
import type { Texture } from 'three'
import type { CardId } from '~~/shared/tarot'

const props = defineProps<{
  cards: CardId[]
  legalMoves: CardId[]
  getFace: (card: string) => Texture | null
  getBack: () => Texture | null
}>()

const emit = defineEmits<{
  play: [card: CardId]
}>()

function slotPosition(index: number, total: number): [number, number, number] {
  const spread = Math.min(2.4, total * 0.18)
  const x = total <= 1 ? 0 : (index / (total - 1) - 0.5) * spread
  const rot = total <= 1 ? 0 : (index / (total - 1) - 0.5) * 0.35
  return [x, 0.04 + index * 0.001, 0.15]
}

function slotRotation(index: number, total: number): [number, number, number] {
  const rot = total <= 1 ? 0 : (index / (total - 1) - 0.5) * 0.35
  return [-0.9, 0, -rot]
}

function onSelect(cardId: string) {
  if (!props.legalMoves.includes(cardId as CardId)) {
    return
  }
  emit('play', cardId as CardId)
}
</script>

<template>
  <TresGroup :position="[0, 0.05, 2.1]">
    <PlayTresCardMesh
      v-for="(card, index) in cards"
      :key="card"
      :card-id="card"
      :face="getFace(card)"
      :back="getBack()"
      face-up
      :interactive="legalMoves.includes(card)"
      :position="slotPosition(index, cards.length)"
      :rotation="slotRotation(index, cards.length)"
      @select="onSelect"
    />
  </TresGroup>
</template>
