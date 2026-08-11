<script setup lang="ts">
import type { Texture } from 'three'
import type { CardId } from '~~/shared/tarot'

const props = defineProps<{
  trick: Array<{ seat: number, card: CardId }>
  getFace: (card: string) => Texture | null
  getBack: () => Texture | null
}>()

function trickPose(index: number, total: number, seat: number): {
  position: [number, number, number]
  rotation: [number, number, number]
} {
  const mid = (total - 1) / 2
  const x = (index - mid) * 0.48
  const yaw = (seat % 5) * 0.12 - 0.24
  return {
    position: [x, 0.04 + index * 0.012, (index - mid) * 0.04],
    rotation: [0, yaw, (index - mid) * 0.04],
  }
}
</script>

<template>
  <TresGroup :position="[0, 0.02, 0.05]">
    <PlayTresCardMesh
      v-for="(entry, index) in trick"
      :key="`${entry.seat}-${entry.card}`"
      :card-id="entry.card"
      :face="getFace(entry.card)"
      :back="getBack()"
      face-up
      :position="trickPose(index, trick.length, entry.seat).position"
      :rotation="trickPose(index, trick.length, entry.seat).rotation"
    />
  </TresGroup>
</template>
