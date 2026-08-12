<script setup lang="ts">
import type { PlayQualityProfile } from '~/composables/usePlayQuality'
import type { AmbianceArtBundle } from '~/utils/playAmbianceArt'
import { createAmbianceArt } from '~/utils/playAmbianceArt'
import { salonCharacterForSeat } from '~~/shared/play/salonCharacters'

const props = withDefaults(defineProps<{
  playerCount: 3 | 4 | 5
  localSeat: number
  quality: PlayQualityProfile
  shadows?: boolean
  tableRadius?: number
  castSalt?: number
}>(), {
  shadows: false,
  tableRadius: 3.35,
  castSalt: 0,
})

const art = shallowRef<AmbianceArtBundle | null>(null)

const wallpaper = computed(() => art.value?.wallpaper ?? null)
const curtainMap = computed(() => art.value?.curtain ?? null)
const painting0 = computed(() => art.value?.paintings[0] ?? null)
const painting1 = computed(() => art.value?.paintings[1] ?? null)
const painting2 = computed(() => art.value?.paintings[2] ?? null)

const candleCount = computed(() => (props.quality === 'low' ? 4 : 6))
const showSideboard = computed(() => props.quality !== 'low')
const showExtraProps = computed(() => props.quality !== 'low')

const woodMat = { color: '#6b4228', roughness: 0.42, metalness: 0.08 }
const brassMat = { color: '#e0c06a', roughness: 0.25, metalness: 0.95 }

const candlePositions = computed(() => {
  const n = candleCount.value
  const r = 0.7
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + 0.15
    return [Math.cos(a) * r, 0.16, Math.sin(a) * r] as [number, number, number]
  })
})

const seats = computed(() => {
  // Outside table rim so full legs/feet read; feet sit on parquet (y≈-0.86)
  const radius = 3.22
  const out: Array<{
    seat: number
    position: [number, number, number]
    yaw: number
    characterId: string
  }> = []
  for (let seat = 0; seat < props.playerCount; seat++) {
    if (seat === props.localSeat) {
      continue
    }
    const rel = (seat - props.localSeat + props.playerCount) % props.playerCount
    const angle = Math.PI / 2 + (rel / props.playerCount) * Math.PI * 2
    const character = salonCharacterForSeat(seat, props.castSalt)
    out.push({
      seat,
      position: [
        Math.cos(angle) * radius * 1.06,
        -0.86,
        Math.sin(angle) * radius,
      ],
      yaw: angle + Math.PI / 2,
      characterId: character.id,
    })
  }
  return out
})

watch(
  () => props.quality,
  (quality) => {
    if (!import.meta.client) {
      return
    }
    art.value?.dispose()
    // Defer heavy canvas work off the first Tres frame
    requestAnimationFrame(() => {
      if (!import.meta.client) {
        return
      }
      try {
        art.value = createAmbianceArt(quality)
      } catch (error) {
        console.warn('[play] ambiance art failed', error)
        art.value = null
      }
    })
  },
  { immediate: true },
)

onUnmounted(() => {
  art.value?.dispose()
  art.value = null
})

function frameMat(map: AmbianceArtBundle['paintings'][number] | null) {
  return {
    color: map ? '#ffffff' : '#2a1a14',
    map,
    roughness: 0.75,
    metalness: 0.02,
  }
}
</script>

<template>
  <TresGroup>
    <!-- Backdrop pulled closer so camera actually frames wallpaper/curtains/paintings -->
    <TresMesh :key="wallpaper ? 'wall-tex' : 'wall-flat'" :position="[0, 1.55, -4.15]" :receive-shadow="shadows">
      <TresPlaneGeometry :args="[16, 6.4]" />
      <TresMeshStandardMaterial
        :color="wallpaper ? '#ffffff' : '#4a3428'"
        :map="wallpaper"
        :roughness="0.9"
        :metalness="0.02"
      />
    </TresMesh>
    <TresMesh :key="curtainMap ? 'curtain-tex' : 'curtain-flat'" :position="[0, 1.7, -4.08]">
      <TresPlaneGeometry :args="[9.2, 3.5]" />
      <TresMeshStandardMaterial
        :color="curtainMap ? '#ffffff' : '#7a2430'"
        :map="curtainMap"
        :roughness="0.82"
        :metalness="0.02"
      />
    </TresMesh>
    <TresMesh :position="[0, 0.15, -4.05]">
      <TresBoxGeometry :args="[16, 1.35, 0.15]" />
      <TresMeshStandardMaterial v-bind="woodMat" />
    </TresMesh>
    <TresMesh :position="[0, 0.85, -3.95]">
      <TresBoxGeometry :args="[15.6, 0.07, 0.08]" />
      <TresMeshStandardMaterial v-bind="brassMat" />
    </TresMesh>

    <TresMesh :position="[-4.9, 1.4, -0.6]" :rotation="[0, Math.PI / 2.35, 0]" :receive-shadow="shadows">
      <TresPlaneGeometry :args="[10, 5.6]" />
      <TresMeshStandardMaterial :color="wallpaper ? '#ffffff' : '#4a3428'" :map="wallpaper" :roughness="0.9" :metalness="0.02" />
    </TresMesh>
    <TresMesh :position="[4.9, 1.4, -0.6]" :rotation="[0, -Math.PI / 2.35, 0]" :receive-shadow="shadows">
      <TresPlaneGeometry :args="[10, 5.6]" />
      <TresMeshStandardMaterial :color="wallpaper ? '#ffffff' : '#4a3428'" :map="wallpaper" :roughness="0.9" :metalness="0.02" />
    </TresMesh>

    <!-- Framed ambiance paintings -->
    <TresGroup :position="[-2.05, 1.95, -4.0]">
      <TresMesh>
        <TresBoxGeometry :args="[1.45, 1.65, 0.08]" />
        <TresMeshStandardMaterial v-bind="brassMat" />
      </TresMesh>
      <TresMesh :key="painting0 ? 'p0' : 'p0f'" :position="[0, 0, 0.05]">
        <TresPlaneGeometry :args="[1.22, 1.42]" />
        <TresMeshStandardMaterial v-bind="frameMat(painting0)" />
      </TresMesh>
    </TresGroup>
    <TresGroup :position="[2.05, 1.95, -4.0]">
      <TresMesh>
        <TresBoxGeometry :args="[1.45, 1.65, 0.08]" />
        <TresMeshStandardMaterial v-bind="brassMat" />
      </TresMesh>
      <TresMesh :key="painting1 ? 'p1' : 'p1f'" :position="[0, 0, 0.05]">
        <TresPlaneGeometry :args="[1.22, 1.42]" />
        <TresMeshStandardMaterial v-bind="frameMat(painting1)" />
      </TresMesh>
    </TresGroup>
    <TresGroup
      v-if="showExtraProps"
      :position="[-4.65, 1.75, -1.9]"
      :rotation="[0, Math.PI / 2.35, 0]"
    >
      <TresMesh>
        <TresBoxGeometry :args="[1.2, 1.4, 0.07]" />
        <TresMeshStandardMaterial v-bind="brassMat" />
      </TresMesh>
      <TresMesh :key="painting2 ? 'p2' : 'p2f'" :position="[0, 0, 0.05]">
        <TresPlaneGeometry :args="[1.0, 1.2]" />
        <TresMeshStandardMaterial v-bind="frameMat(painting2)" />
      </TresMesh>
    </TresGroup>

    <!-- Chandelier -->
    <TresGroup :position="[0, 2.55, 0.1]">
      <TresMesh>
        <TresCylinderGeometry :args="[0.04, 0.04, 0.7, 8]" />
        <TresMeshStandardMaterial v-bind="brassMat" />
      </TresMesh>
      <TresMesh :position="[0, -0.35, 0]" :rotation="[Math.PI / 2, 0, 0]">
        <TresTorusGeometry :args="[0.78, 0.05, 10, 36]" />
        <TresMeshStandardMaterial v-bind="brassMat" />
      </TresMesh>
      <TresGroup
        v-for="(pos, i) in candlePositions"
        :key="i"
        :position="pos"
      >
        <TresMesh :position="[0, -0.12, 0]">
          <TresCylinderGeometry :args="[0.035, 0.04, 0.22, 8]" />
          <TresMeshStandardMaterial v-bind="brassMat" />
        </TresMesh>
        <TresMesh>
          <TresSphereGeometry :args="[0.09, 12, 12]" />
          <TresMeshStandardMaterial
            color="#ffe0a8"
            :emissive="'#ffb060'"
            :emissive-intensity="2"
            :roughness="0.5"
            :metalness="0"
          />
        </TresMesh>
      </TresGroup>
      <TresPointLight
        :position="[0, -0.2, 0]"
        color="#ffd2a0"
        :intensity="1.8"
        :distance="12"
        :decay="2"
      />
    </TresGroup>

    <!-- Opponent figures — 10 img2threejs-style cast factories -->
    <TresGroup
      v-for="seat in seats"
      :key="seat.seat"
      :position="seat.position"
      :rotation="[0, -seat.yaw, 0]"
    >
      <PlayTresSalonAvatar
        :character-id="seat.characterId"
        :shadows="shadows"
      />
    </TresGroup>

    <!-- Sideboard + props -->
    <TresGroup v-if="showSideboard" :position="[0, 0.2, -3.55]">
      <TresMesh :cast-shadow="shadows" :receive-shadow="shadows">
        <TresBoxGeometry :args="[2.8, 1.0, 0.55]" />
        <TresMeshStandardMaterial v-bind="woodMat" />
      </TresMesh>
      <TresMesh :position="[0, 0.54, 0]">
        <TresBoxGeometry :args="[2.9, 0.06, 0.6]" />
        <TresMeshStandardMaterial v-bind="brassMat" />
      </TresMesh>
      <!-- Candle -->
      <TresMesh :position="[0.95, 0.85, 0.05]">
        <TresCylinderGeometry :args="[0.08, 0.09, 0.45, 10]" />
        <TresMeshStandardMaterial color="#5a3018" :roughness="0.55" :metalness="0.05" />
      </TresMesh>
      <TresMesh :position="[0.95, 1.15, 0.05]">
        <TresSphereGeometry :args="[0.12, 12, 12]" />
        <TresMeshStandardMaterial
          color="#ffe0a8"
          :emissive="'#ffb060'"
          :emissive-intensity="1.6"
        />
      </TresMesh>
      <!-- Decanter -->
      <TresMesh :position="[-0.85, 0.82, 0.05]" :cast-shadow="shadows">
        <TresCylinderGeometry :args="[0.09, 0.12, 0.4, 12]" />
        <TresMeshStandardMaterial color="#4a1830" :roughness="0.25" :metalness="0.15" :transparent="true" :opacity="0.85" />
      </TresMesh>
      <TresMesh :position="[-0.85, 1.08, 0.05]">
        <TresCylinderGeometry :args="[0.04, 0.06, 0.18, 10]" />
        <TresMeshStandardMaterial color="#4a1830" :roughness="0.25" :metalness="0.15" :transparent="true" :opacity="0.85" />
      </TresMesh>
      <!-- Wine glasses -->
      <TresGroup
        v-for="(gx, gi) in [-0.35, 0.1]"
        :key="gi"
        :position="[gx, 0.62, 0.12]"
      >
        <TresMesh>
          <TresCylinderGeometry :args="[0.045, 0.03, 0.12, 10]" />
          <TresMeshStandardMaterial color="#d8ecec" :roughness="0.15" :metalness="0.05" :transparent="true" :opacity="0.45" />
        </TresMesh>
        <TresMesh :position="[0, -0.1, 0]">
          <TresCylinderGeometry :args="[0.012, 0.012, 0.1, 8]" />
          <TresMeshStandardMaterial color="#d8ecec" :roughness="0.15" :metalness="0.05" :transparent="true" :opacity="0.5" />
        </TresMesh>
        <TresMesh :position="[0, -0.16, 0]">
          <TresCylinderGeometry :args="[0.04, 0.04, 0.02, 10]" />
          <TresMeshStandardMaterial color="#d8ecec" :roughness="0.15" :metalness="0.05" :transparent="true" :opacity="0.5" />
        </TresMesh>
      </TresGroup>
      <!-- Card box -->
      <TresMesh
        v-if="showExtraProps"
        :position="[0.35, 0.62, -0.05]"
        :rotation="[0, 0.3, 0]"
        :cast-shadow="shadows"
      >
        <TresBoxGeometry :args="[0.28, 0.1, 0.38]" />
        <TresMeshStandardMaterial color="#5c1f2e" :roughness="0.55" :metalness="0.08" />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
