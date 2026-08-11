<script setup lang="ts">
// Stub until Tasks 6–7 expand the playable table scene.
</script>

<template>
  <ClientOnly>
    <TresCanvas
      clear-color="#1a1f16"
      class="h-full w-full"
    >
      <TresPerspectiveCamera
        :position="[0, 4.5, 6]"
        :look-at="[0, 0, 0]"
      />
      <TresAmbientLight :intensity="0.7" />
      <TresMesh :rotation="[-Math.PI / 2, 0, 0]">
        <TresCircleGeometry :args="[3.2, 48]" />
        <TresMeshStandardMaterial color="#2f5d3a" />
      </TresMesh>
    </TresCanvas>
  </ClientOnly>
</template>
