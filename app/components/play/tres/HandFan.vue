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
  const t = total <= 1 ? 0.5 : index / (total - 1)
  const spread = Math.min(3.2, 0.95 + total * 0.14)
  const x = (t - 0.5) * spread
  const fan = (t - 0.5) * (t - 0.5)
  const z = fan * 0.35
  const y = 0.02 + index * 0.004
  return [x, y, z]
}

function slotRotation(index: number, total: number): [number, number, number] {
  const t = total <= 1 ? 0.5 : index / (total - 1)
  const twist = (t - 0.5) * 0.55
  // Tip toward the camera so ranks stay readable
  return [-1.05, 0, -twist]
}

function onSelect(cardId: string) {
  if (!props.legalMoves.includes(cardId as CardId)) {
    return
  }
  emit('play', cardId as CardId)
}
</script>

<template>
  <TresGroup :position="[0, 0.12, 2.05]">
    <PlayTresCardMesh
      v-for="(card, index) in cards"
      :key="card"
      :card-id="card"
      :face="getFace(card)"
      :back="getBack()"
      face-up
      :interactive="legalMoves.includes(card)"
      :lifted="legalMoves.includes(card)"
      :position="slotPosition(index, cards.length)"
      :rotation="slotRotation(index, cards.length)"
      @select="onSelect"
    />
  </TresGroup>
</template>
