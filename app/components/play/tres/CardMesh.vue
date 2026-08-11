<script setup lang="ts">
import type { Texture } from 'three'
import { isTrump } from '~~/shared/tarot'
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

const CARD_W = 0.62
const CARD_H = 0.88
const CARD_D = 0.018

const scaleY = computed(() => (isTrump(props.cardId as CardId) ? 1.18 : 1))
const liftY = computed(() => (props.lifted ? 0.08 : 0))
</script>

<template>
  <TresGroup
    :position="[position[0], position[1] + liftY, position[2]]"
    :rotation="rotation"
    :scale="[1, scaleY, 1]"
    @click.stop="interactive && emit('select', cardId)"
  >
    <!-- Card body -->
    <TresMesh cast-shadow receive-shadow>
      <TresBoxGeometry :args="[CARD_W, CARD_D, CARD_H]" />
      <TresMeshStandardMaterial
        color="#d6d3d1"
        :roughness="0.85"
        :metalness="0.02"
      />
    </TresMesh>

    <!-- Face -->
    <TresMesh
      :position="[0, CARD_D * 0.52, 0]"
      :rotation="faceUp ? [-Math.PI / 2, 0, 0] : [Math.PI / 2, 0, Math.PI]"
    >
      <TresPlaneGeometry :args="[CARD_W * 0.96, CARD_H * 0.96]" />
      <TresMeshStandardMaterial
        :map="faceUp ? face : back"
        :color="(faceUp ? face : back) ? '#ffffff' : '#f5f0e8'"
        :roughness="0.55"
        :metalness="0.02"
      />
    </TresMesh>

    <!-- Back -->
    <TresMesh
      :position="[0, -CARD_D * 0.52, 0]"
      :rotation="[Math.PI / 2, 0, 0]"
    >
      <TresPlaneGeometry :args="[CARD_W * 0.96, CARD_H * 0.96]" />
      <TresMeshStandardMaterial
        :map="back"
        :color="back ? '#ffffff' : '#4a2033'"
        :roughness="0.6"
        :metalness="0.04"
      />
    </TresMesh>

    <!-- Legal-move rim -->
    <TresMesh
      v-if="interactive"
      :position="[0, CARD_D * 0.56, 0]"
      :rotation="[-Math.PI / 2, 0, 0]"
    >
      <TresPlaneGeometry :args="[CARD_W * 1.04, CARD_H * 1.04]" />
      <TresMeshBasicMaterial
        color="#fbbf24"
        :transparent="true"
        :opacity="0.22"
        :depth-write="false"
      />
    </TresMesh>
  </TresGroup>
</template>
