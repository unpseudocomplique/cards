<script setup lang="ts">
import type { Texture } from 'three'
import type { CardId } from '~~/shared/tarot'

const props = withDefaults(defineProps<{
  cardId: CardId | string
  face: Texture | null
  back: Texture | null
  faceUp?: boolean
  position?: [number, number, number]
  rotation?: [number, number, number]
  interactive?: boolean
  lifted?: boolean
}>(), {
  faceUp: true,
  position: () => [0, 0, 0],
  rotation: () => [0, 0, 0],
  interactive: false,
  lifted: false,
})

const emit = defineEmits<{
  select: [cardId: string]
}>()

/** Slim playing-card proportions (world units). */
const CARD_W = 0.52
const CARD_H = 0.78
const CARD_D = 0.006

const liftY = computed(() => (props.lifted ? 0.05 : 0))
const faceMap = computed(() => (props.faceUp ? props.face : props.back))
</script>

<template>
  <TresGroup
    :position="[position[0], position[1] + liftY, position[2]]"
    :rotation="rotation"
    @click.stop="interactive && emit('select', cardId)"
  >
    <!-- Thin body -->
    <TresMesh
      cast-shadow
      receive-shadow
    >
      <TresBoxGeometry :args="[CARD_W, CARD_D, CARD_H]" />
      <TresMeshStandardMaterial
        color="#e7e5e4"
        :roughness="0.9"
        :metalness="0"
      />
    </TresMesh>

    <!-- Face (up when faceUp) -->
    <TresMesh
      :position="[0, CARD_D * 0.55, 0]"
      :rotation="[-Math.PI / 2, 0, faceUp ? 0 : Math.PI]"
    >
      <TresPlaneGeometry :args="[CARD_W * 0.97, CARD_H * 0.97]" />
      <TresMeshStandardMaterial
        :map="faceMap"
        :color="faceMap ? '#ffffff' : '#f5f0e8'"
        :roughness="0.45"
        :metalness="0.02"
      />
    </TresMesh>

    <!-- Opposite side -->
    <TresMesh
      :position="[0, -CARD_D * 0.55, 0]"
      :rotation="[Math.PI / 2, 0, faceUp ? 0 : Math.PI]"
    >
      <TresPlaneGeometry :args="[CARD_W * 0.97, CARD_H * 0.97]" />
      <TresMeshStandardMaterial
        :map="faceUp ? back : face"
        :color="(faceUp ? back : face) ? '#ffffff' : '#4a2033'"
        :roughness="0.5"
        :metalness="0.03"
      />
    </TresMesh>
  </TresGroup>
</template>
