<script setup lang="ts">
import { DoubleSide, type Texture } from 'three'
import type { SalonTextureBundle } from '~/utils/playSalonMaterials'
import { createSalonTextures } from '~/utils/playSalonMaterials'
import type { PlayQualityProfile } from '~/composables/usePlayQuality'

const apronSide = DoubleSide

const props = withDefaults(defineProps<{
  radius?: number
  quality?: PlayQualityProfile
  shadows?: boolean
}>(), {
  radius: 3.35,
  quality: 'medium',
  shadows: false,
})

const textures = shallowRef<SalonTextureBundle | null>(null)

const woodMap = computed(() => textures.value?.ebony.map ?? null)
const woodRough = computed(() => textures.value?.ebony.roughnessMap ?? null)
const feltMap = computed(() => textures.value?.felt.map ?? null)
const feltRough = computed(() => textures.value?.felt.roughnessMap ?? null)
const brassMap = computed(() => textures.value?.brass.map ?? null)
const brassRough = computed(() => textures.value?.brass.roughnessMap ?? null)
const floorMap = computed(() => textures.value?.parquet.map ?? null)
const floorRough = computed(() => textures.value?.parquet.roughnessMap ?? null)

const showLegs = computed(() => true)
const showGoldTrim = computed(() => true)
const legPositions = computed(() => {
  const r = props.radius * 0.72
  return [
    [r * 0.78, -0.42, r * 0.42],
    [-r * 0.78, -0.42, r * 0.42],
    [r * 0.78, -0.42, -r * 0.42],
    [-r * 0.78, -0.42, -r * 0.42],
  ] as Array<[number, number, number]>
})

function setMapRepeat(tex: Texture | null, x: number, y: number) {
  if (!tex) {
    return
  }
  tex.repeat.set(x, y)
  tex.needsUpdate = true
}

watch(
  () => props.quality,
  (quality) => {
    if (!import.meta.client) {
      return
    }
    textures.value?.dispose()
    textures.value = null
    requestAnimationFrame(() => {
      if (!import.meta.client) {
        return
      }
      try {
        const bundle = createSalonTextures(quality)
        setMapRepeat(bundle.parquet.map, 6, 6)
        setMapRepeat(bundle.parquet.roughnessMap, 6, 6)
        setMapRepeat(bundle.felt.map, 2.4, 2.4)
        setMapRepeat(bundle.felt.roughnessMap, 2.4, 2.4)
        setMapRepeat(bundle.ebony.map, 2, 1)
        setMapRepeat(bundle.ebony.roughnessMap, 2, 1)
        textures.value = bundle
      } catch (error) {
        console.warn('[play] salon textures failed', error)
        textures.value = null
      }
    })
  },
  { immediate: true },
)

onUnmounted(() => {
  textures.value?.dispose()
  textures.value = null
})
</script>

<template>
  <TresGroup>
    <!-- Parquet floor -->
    <TresMesh
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, -0.86, 0]"
      :receive-shadow="shadows"
    >
      <TresPlaneGeometry :args="[32, 32]" />
      <TresMeshStandardMaterial
        color="#1a100c"
        :map="floorMap"
        :roughness-map="floorRough"
        :roughness="0.78"
        :metalness="0.04"
      />
    </TresMesh>

    <!-- Pedestal / under-apron shadow disc -->
    <TresMesh
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, -0.84, 0]"
      :scale="[1.18, 1, 1]"
    >
      <TresCircleGeometry :args="[radius * 1.05, 48]" />
      <TresMeshStandardMaterial
        color="#0a0706"
        :roughness="1"
        :metalness="0"
        :transparent="true"
        :opacity="0.55"
      />
    </TresMesh>

    <!-- Thick wood apron (outer) -->
    <TresMesh
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, -0.02, 0]"
      :scale="[1.18, 1, 1]"
      :receive-shadow="shadows"
      :cast-shadow="shadows"
    >
      <TresRingGeometry :args="[radius * 0.9, radius * 1.1, quality === 'low' ? 48 : 72]" />
      <TresMeshStandardMaterial
        color="#6b4228"
        :map="woodMap"
        :roughness-map="woodRough"
        :roughness="0.4"
        :metalness="0.1"
      />
    </TresMesh>

    <!-- Apron vertical band -->
    <TresMesh
      :position="[0, -0.22, 0]"
      :scale="[1.18, 1, 1]"
      :cast-shadow="shadows"
      :receive-shadow="shadows"
    >
      <TresCylinderGeometry :args="[radius * 1.08, radius * 1.1, 0.4, quality === 'low' ? 40 : 64, 1, true]" />
      <TresMeshStandardMaterial
        color="#3a2418"
        :map="woodMap"
        :roughness-map="woodRough"
        :roughness="0.5"
        :metalness="0.06"
        :side="apronSide"
      />
    </TresMesh>

    <!-- Inner wood lip -->
    <TresMesh
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, 0.01, 0]"
      :scale="[1.18, 1, 1]"
    >
      <TresRingGeometry :args="[radius * 0.86, radius * 0.9, quality === 'low' ? 40 : 64]" />
      <TresMeshStandardMaterial
        color="#3a2416"
        :map="woodMap"
        :roughness-map="woodRough"
        :roughness="0.48"
        :metalness="0.05"
      />
    </TresMesh>

    <!-- Gold inlay ring -->
    <TresMesh
      v-if="showGoldTrim"
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, 0.018, 0]"
      :scale="[1.18, 1, 1]"
    >
      <TresRingGeometry :args="[radius * 0.868, radius * 0.9, 64]" />
      <TresMeshStandardMaterial
        color="#e0c06a"
        :map="brassMap"
        :roughness-map="brassRough"
        :roughness="0.25"
        :metalness="0.95"
        :emissive="'#a07830'"
        :emissive-intensity="0.15"
      />
    </TresMesh>

    <!-- Felt playing surface -->
    <TresMesh
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, 0.02, 0]"
      :scale="[1.18, 1, 1]"
      :receive-shadow="shadows"
    >
      <TresCircleGeometry :args="[radius * 0.86, quality === 'low' ? 48 : 72]" />
      <TresMeshStandardMaterial
        color="#2f5c3f"
        :map="feltMap"
        :roughness-map="feltRough"
        :roughness="0.94"
        :metalness="0"
      />
    </TresMesh>

    <!-- Soft center vignette -->
    <TresMesh
      :rotation="[-Math.PI / 2, 0, 0]"
      :position="[0, 0.025, 0]"
      :scale="[1.18, 1, 1]"
    >
      <TresCircleGeometry :args="[radius * 0.4, 40]" />
      <TresMeshStandardMaterial
        color="#0f2418"
        :roughness="1"
        :metalness="0"
        :transparent="true"
        :opacity="0.4"
      />
    </TresMesh>

    <!-- Turned legs -->
    <TresGroup v-if="showLegs">
      <TresGroup
        v-for="(pos, i) in legPositions"
        :key="i"
        :position="pos"
      >
        <TresMesh :cast-shadow="shadows" :receive-shadow="shadows">
          <TresCylinderGeometry :args="[0.09, 0.11, 0.72, 12]" />
          <TresMeshStandardMaterial
            color="#22140e"
            :map="woodMap"
            :roughness-map="woodRough"
            :roughness="0.5"
            :metalness="0.05"
          />
        </TresMesh>
        <TresMesh :position="[0, 0.22, 0]">
          <TresTorusGeometry :args="[0.11, 0.025, 8, 16]" />
          <TresMeshStandardMaterial
            color="#b08d3e"
            :map="brassMap"
            :roughness="0.35"
            :metalness="0.9"
          />
        </TresMesh>
        <TresMesh :position="[0, -0.34, 0]" :cast-shadow="shadows">
          <TresCylinderGeometry :args="[0.14, 0.16, 0.06, 12]" />
          <TresMeshStandardMaterial
            color="#1a100c"
            :map="woodMap"
            :roughness="0.55"
            :metalness="0.04"
          />
        </TresMesh>
      </TresGroup>
    </TresGroup>
  </TresGroup>
</template>
