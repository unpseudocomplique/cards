<script setup lang="ts">
defineProps<{
  radius?: number
}>()
</script>

<template>
  <TresMesh
    :rotation="[-Math.PI / 2, 0, 0]"
    receive-shadow
  >
    <TresCircleGeometry :args="[radius ?? 3.2, 48]" />
    <TresMeshStandardMaterial
      color="#2f5d3a"
      :roughness="0.9"
      :metalness="0.05"
    />
  </TresMesh>
</template>
