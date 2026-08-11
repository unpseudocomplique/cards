<script setup lang="ts">
import type { Texture } from 'three'
import type { CardId } from '~~/shared/tarot'

defineProps<{
  trick: Array<{ seat: number, card: CardId }>
  getFace: (card: string) => Texture | null
  getBack: () => Texture | null
}>()
</script>

<template>
  <TresGroup :position="[0, 0.05, 0]">
    <PlayTresCardMesh
      v-for="(entry, index) in trick"
      :key="`${entry.seat}-${entry.card}`"
      :card-id="entry.card"
      :face="getFace(entry.card)"
      :back="getBack()"
      face-up
      :position="[(index - (trick.length - 1) / 2) * 0.55, 0.02 + index * 0.002, 0]"
      :rotation="[-Math.PI / 2, 0, 0]"
    />
  </TresGroup>
</template>
