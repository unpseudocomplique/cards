<script setup lang="ts">
import type { Texture } from 'three'
import { isTrump } from '~~/shared/tarot'
import type { CardId } from '~~/shared/tarot'

const props = defineProps<{
  cardId: CardId | string
  face: Texture | null
  back: Texture | null
  faceUp?: boolean
  position?: [number, number, number]
  rotation?: [number, number, number]
  interactive?: boolean
}>()

const emit = defineEmits<{
  select: [cardId: string]
}>()

const scaleY = computed(() => (isTrump(props.cardId as CardId) ? 1.35 : 1))
</script>

<template>
  <TresGroup
    :position="position ?? [0, 0, 0]"
    :rotation="rotation ?? [0, 0, 0]"
    :scale="[1, scaleY, 1]"
    @click.stop="interactive && emit('select', cardId)"
  >
    <!-- Front -->
    <TresMesh
      :position="[0, 0.006, 0]"
      :rotation="faceUp === false ? [0, Math.PI, 0] : [0, 0, 0]"
    >
      <TresPlaneGeometry :args="[0.63, 0.88]" />
      <TresMeshStandardMaterial
        :map="faceUp === false ? back : face"
        :color="(faceUp === false ? back : face) ? '#ffffff' : '#e2e8f0'"
      />
    </TresMesh>
    <!-- Back plane (opposite) -->
    <TresMesh
      :position="[0, -0.006, 0]"
      :rotation="[0, Math.PI, 0]"
    >
      <TresPlaneGeometry :args="[0.63, 0.88]" />
      <TresMeshStandardMaterial
        :map="back"
        :color="back ? '#ffffff' : '#1e293b'"
      />
    </TresMesh>
  </TresGroup>
</template>
