<script setup lang="ts">
withDefaults(defineProps<{
  radius?: number
}>(), {
  radius: 3.35,
})
</script>

<template>
  <TresGroup>
    <!-- Room floor -->
    <TresMesh
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, -0.04, 0]"
      receive-shadow
    >
      <TresPlaneGeometry :args="[28, 28]" />
      <TresMeshStandardMaterial
        color="#14110f"
        :roughness="0.95"
        :metalness="0.02"
      />
    </TresMesh>

    <!-- Wood apron / rim -->
    <TresMesh
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, 0.01, 0]"
      :scale="[1.18, 1, 1]"
      receive-shadow
      cast-shadow
    >
      <TresRingGeometry :args="[radius * 0.92, radius * 1.08, 72]" />
      <TresMeshStandardMaterial
        color="#5c3a22"
        :roughness="0.72"
        :metalness="0.08"
      />
    </TresMesh>

    <!-- Inner wood lip -->
    <TresMesh
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, 0.015, 0]"
      :scale="[1.18, 1, 1]"
    >
      <TresRingGeometry :args="[radius * 0.88, radius * 0.92, 72]" />
      <TresMeshStandardMaterial
        color="#3f2818"
        :roughness="0.8"
        :metalness="0.05"
      />
    </TresMesh>

    <!-- Felt playing surface (slightly elliptical) -->
    <TresMesh
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, 0.02, 0]"
      :scale="[1.18, 1, 1]"
      receive-shadow
    >
      <TresCircleGeometry :args="[radius * 0.88, 72]" />
      <TresMeshStandardMaterial
        color="#1f4d32"
        :roughness="0.92"
        :metalness="0"
      />
    </TresMesh>

    <!-- Soft center vignette on felt -->
    <TresMesh
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, 0.025, 0]"
      :scale="[1.18, 1, 1]"
    >
      <TresCircleGeometry :args="[radius * 0.42, 48]" />
      <TresMeshStandardMaterial
        color="#163828"
        :roughness="1"
        :metalness="0"
        :transparent="true"
        :opacity="0.45"
      />
    </TresMesh>
  </TresGroup>
</template>
