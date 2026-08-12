<script setup lang="ts">
/**
 * Full-body seated salon avatar. Loads AI face from URL (avoids broken Texture props).
 */
import * as THREE from 'three'

const props = withDefaults(defineProps<{
  seed?: number
  shadows?: boolean
  faceUrl?: string | null
  accentColor?: string
  accessory?: 'pin' | 'glasses' | 'scarf' | 'bow' | 'none'
}>(), {
  seed: 0,
  shadows: false,
  faceUrl: null,
  accentColor: undefined,
  accessory: undefined,
})

const palettes = [
  { skin: '#d4a574', suit: '#1a1520', hair: '#1c1410', accent: '#d4a84b', shirt: '#efe6d8', shoe: '#0e0c0a' },
  { skin: '#c6865a', suit: '#152018', hair: '#2a1a10', accent: '#c9a227', shirt: '#f2ebe0', shoe: '#120e0c' },
  { skin: '#e0b896', suit: '#201818', hair: '#3b2a1c', accent: '#e0c06a', shirt: '#ebe2d4', shoe: '#0c0a08' },
  { skin: '#a86f45', suit: '#181820', hair: '#0f0c0a', accent: '#b08d3e', shirt: '#f0e8dc', shoe: '#101010' },
  { skin: '#dbb08a', suit: '#1c1820', hair: '#4a3020', accent: '#d4a84b', shirt: '#efe6d8', shoe: '#0e0c0a' },
  { skin: '#8d5524', suit: '#12161c', hair: '#0a0806', accent: '#c4a35a', shirt: '#e8dfd0', shoe: '#0a0806' },
  { skin: '#f0c8a0', suit: '#1c1218', hair: '#5a3a28', accent: '#e8c070', shirt: '#f5efe6', shoe: '#120e0a' },
  { skin: '#b07a55', suit: '#141c18', hair: '#2c1810', accent: '#d0b060', shirt: '#efe8dc', shoe: '#0c0a08' },
] as const

const accessories = ['pin', 'glasses', 'scarf', 'bow', 'pin'] as const

const palette = computed(() => palettes[props.seed % palettes.length]!)
const accent = computed(() => props.accentColor ?? palette.value.accent)
const accessory = computed(() => props.accessory ?? accessories[props.seed % accessories.length]!)

const faceMap = shallowRef<THREE.Texture | null>(null)
const faceKey = shallowRef('face-off')
let loadGen = 0

/** Crop framed bust portraits to a face-centric plate (salon-cast assets). */
function drawFacePlate(image: HTMLImageElement): HTMLCanvasElement {
  const out = 256
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')!
  // Skip ornate frame + torso: zoom into upper-center face.
  const sx = image.width * 0.22
  const sy = image.height * 0.08
  const sw = image.width * 0.56
  const sh = image.height * 0.56
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, out, out)
  return canvas
}

async function loadFace(url: string | null | undefined) {
  const gen = ++loadGen
  faceMap.value?.dispose()
  faceMap.value = null
  faceKey.value = 'face-off'
  if (!import.meta.client || !url) {
    return
  }
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`face ${url}`))
      img.src = url
    })
    if (gen !== loadGen) {
      return
    }
    const texture = new THREE.CanvasTexture(drawFacePlate(image))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.flipY = true
    texture.anisotropy = 4
    texture.needsUpdate = true
    faceMap.value = texture
    faceKey.value = `face-${texture.uuid}`
  } catch (error) {
    console.warn('[play] salon face failed', url, error)
  }
}

watch(() => props.faceUrl, (url) => {
  void loadFace(url)
}, { immediate: true })

onUnmounted(() => {
  loadGen++
  faceMap.value?.dispose()
  faceMap.value = null
})

const hasFace = computed(() => !!faceMap.value)
</script>

<template>
  <TresGroup>
    <!-- Chair -->
    <TresMesh :position="[0, 0.48, 0.05]" :cast-shadow="shadows" :receive-shadow="shadows">
      <TresBoxGeometry :args="[0.95, 0.12, 0.85]" />
      <TresMeshStandardMaterial color="#6a3a24" :roughness="0.65" :metalness="0.04" />
    </TresMesh>
    <TresMesh :position="[0, 1.15, -0.38]" :cast-shadow="shadows">
      <TresBoxGeometry :args="[0.95, 1.35, 0.12]" />
      <TresMeshStandardMaterial color="#7a4528" :roughness="0.45" :metalness="0.06" />
    </TresMesh>
    <TresMesh :position="[0, 1.82, -0.38]">
      <TresBoxGeometry :args="[1.0, 0.08, 0.14]" />
      <TresMeshStandardMaterial :color="accent" :roughness="0.26" :metalness="0.92" />
    </TresMesh>
    <TresMesh
      v-for="(leg, i) in [
        [-0.38, 0.22, 0.32],
        [0.38, 0.22, 0.32],
        [-0.38, 0.22, -0.28],
        [0.38, 0.22, -0.28],
      ]"
      :key="`chair-${i}`"
      :position="leg"
      :cast-shadow="shadows"
    >
      <TresCylinderGeometry :args="[0.055, 0.065, 0.44, 8]" />
      <TresMeshStandardMaterial color="#4a2818" :roughness="0.55" :metalness="0.05" />
    </TresMesh>

    <!-- Lower body -->
    <TresMesh :position="[0, 0.58, 0.08]" :cast-shadow="shadows">
      <TresBoxGeometry :args="[0.55, 0.28, 0.42]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.52" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="[-0.16, 0.52, 0.42]" :rotation="[1.15, 0, 0.05]" :cast-shadow="shadows">
      <TresBoxGeometry :args="[0.2, 0.22, 0.58]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.52" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="[0.16, 0.52, 0.42]" :rotation="[1.15, 0, -0.05]" :cast-shadow="shadows">
      <TresBoxGeometry :args="[0.2, 0.22, 0.58]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.52" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="[-0.17, 0.38, 0.72]" :cast-shadow="shadows">
      <TresSphereGeometry :args="[0.11, 10, 10]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.5" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="[0.17, 0.38, 0.72]" :cast-shadow="shadows">
      <TresSphereGeometry :args="[0.11, 10, 10]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.5" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="[-0.18, 0.18, 0.78]" :rotation="[0.15, 0, 0]" :cast-shadow="shadows">
      <TresCylinderGeometry :args="[0.08, 0.09, 0.42, 10]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.52" :metalness="0.04" />
    </TresMesh>
    <TresMesh :position="[0.18, 0.18, 0.78]" :rotation="[0.15, 0, 0]" :cast-shadow="shadows">
      <TresCylinderGeometry :args="[0.08, 0.09, 0.42, 10]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.52" :metalness="0.04" />
    </TresMesh>
    <TresMesh :position="[-0.18, 0.04, 0.92]" :cast-shadow="shadows">
      <TresBoxGeometry :args="[0.16, 0.08, 0.28]" />
      <TresMeshStandardMaterial :color="palette.shoe" :roughness="0.55" :metalness="0.08" />
    </TresMesh>
    <TresMesh :position="[0.18, 0.04, 0.92]" :cast-shadow="shadows">
      <TresBoxGeometry :args="[0.16, 0.08, 0.28]" />
      <TresMeshStandardMaterial :color="palette.shoe" :roughness="0.55" :metalness="0.08" />
    </TresMesh>

    <!-- Torso -->
    <TresMesh :position="[0, 1.05, 0.02]" :cast-shadow="shadows">
      <TresBoxGeometry :args="[0.62, 0.85, 0.38]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.48" :metalness="0.06" />
    </TresMesh>
    <TresMesh :position="[0, 1.35, 0.04]" :cast-shadow="shadows">
      <TresBoxGeometry :args="[0.66, 0.35, 0.36]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.48" :metalness="0.06" />
    </TresMesh>
    <TresMesh :position="[-0.14, 1.2, 0.2]" :rotation="[0, 0, 0.35]">
      <TresBoxGeometry :args="[0.18, 0.55, 0.04]" />
      <TresMeshStandardMaterial color="#0c0a10" :roughness="0.48" :metalness="0.1" />
    </TresMesh>
    <TresMesh :position="[0.14, 1.2, 0.2]" :rotation="[0, 0, -0.35]">
      <TresBoxGeometry :args="[0.18, 0.55, 0.04]" />
      <TresMeshStandardMaterial color="#0c0a10" :roughness="0.48" :metalness="0.1" />
    </TresMesh>
    <TresMesh :position="[0, 1.32, 0.18]">
      <TresBoxGeometry :args="[0.24, 0.4, 0.1]" />
      <TresMeshStandardMaterial :color="palette.shirt" :roughness="0.7" :metalness="0" />
    </TresMesh>

    <TresMesh v-if="accessory === 'bow' || accessory === 'scarf'" :position="[0, 1.42, 0.24]">
      <TresBoxGeometry :args="accessory === 'scarf' ? [0.32, 0.1, 0.06] : [0.18, 0.07, 0.05]" />
      <TresMeshStandardMaterial :color="accent" :roughness="0.4" :metalness="0.2" />
    </TresMesh>
    <TresMesh v-if="accessory === 'bow'" :position="[-0.1, 1.42, 0.25]" :rotation="[0, 0, 0.4]">
      <TresBoxGeometry :args="[0.12, 0.08, 0.03]" />
      <TresMeshStandardMaterial :color="accent" :roughness="0.4" :metalness="0.2" />
    </TresMesh>
    <TresMesh v-if="accessory === 'bow'" :position="[0.1, 1.42, 0.25]" :rotation="[0, 0, -0.4]">
      <TresBoxGeometry :args="[0.12, 0.08, 0.03]" />
      <TresMeshStandardMaterial :color="accent" :roughness="0.4" :metalness="0.2" />
    </TresMesh>

    <!-- Arms -->
    <TresMesh :position="[-0.4, 1.35, 0]" :cast-shadow="shadows">
      <TresSphereGeometry :args="[0.15, 12, 12]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.5" :metalness="0.06" />
    </TresMesh>
    <TresMesh :position="[0.4, 1.35, 0]" :cast-shadow="shadows">
      <TresSphereGeometry :args="[0.15, 12, 12]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.5" :metalness="0.06" />
    </TresMesh>
    <TresMesh :position="[-0.5, 1.05, 0.12]" :rotation="[0.85, 0, 0.2]" :cast-shadow="shadows">
      <TresCylinderGeometry :args="[0.09, 0.1, 0.42, 10]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.5" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="[0.5, 1.05, 0.12]" :rotation="[0.85, 0, -0.2]" :cast-shadow="shadows">
      <TresCylinderGeometry :args="[0.09, 0.1, 0.42, 10]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.5" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="[-0.52, 0.82, 0.32]" :cast-shadow="shadows">
      <TresSphereGeometry :args="[0.09, 10, 10]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.5" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="[0.52, 0.82, 0.32]" :cast-shadow="shadows">
      <TresSphereGeometry :args="[0.09, 10, 10]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.5" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="[-0.42, 0.68, 0.55]" :rotation="[1.2, 0.1, 0]" :cast-shadow="shadows">
      <TresCylinderGeometry :args="[0.075, 0.085, 0.4, 10]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.5" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="[0.42, 0.68, 0.55]" :rotation="[1.2, -0.1, 0]" :cast-shadow="shadows">
      <TresCylinderGeometry :args="[0.075, 0.085, 0.4, 10]" />
      <TresMeshStandardMaterial :color="palette.suit" :roughness="0.5" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="[-0.36, 0.58, 0.78]" :cast-shadow="shadows">
      <TresSphereGeometry :args="[0.09, 10, 10]" />
      <TresMeshStandardMaterial :color="palette.skin" :roughness="0.65" :metalness="0" />
    </TresMesh>
    <TresMesh :position="[0.36, 0.58, 0.78]" :cast-shadow="shadows">
      <TresSphereGeometry :args="[0.09, 10, 10]" />
      <TresMeshStandardMaterial :color="palette.skin" :roughness="0.65" :metalness="0" />
    </TresMesh>
    <TresMesh :position="[-0.36, 0.56, 0.9]">
      <TresBoxGeometry :args="[0.14, 0.04, 0.12]" />
      <TresMeshStandardMaterial :color="palette.skin" :roughness="0.65" :metalness="0" />
    </TresMesh>
    <TresMesh :position="[0.36, 0.56, 0.9]">
      <TresBoxGeometry :args="[0.14, 0.04, 0.12]" />
      <TresMeshStandardMaterial :color="palette.skin" :roughness="0.65" :metalness="0" />
    </TresMesh>

    <TresMesh v-if="accessory === 'pin'" :position="[0.2, 1.22, 0.22]">
      <TresSphereGeometry :args="[0.04, 10, 10]" />
      <TresMeshStandardMaterial
        :color="accent"
        :roughness="0.2"
        :metalness="0.95"
        :emissive="accent"
        :emissive-intensity="0.35"
      />
    </TresMesh>

    <!-- Head -->
    <TresMesh :position="[0, 1.55, 0.04]">
      <TresCylinderGeometry :args="[0.1, 0.12, 0.18, 12]" />
      <TresMeshStandardMaterial :color="palette.skin" :roughness="0.65" :metalness="0" />
    </TresMesh>
    <TresMesh :position="[0, 1.82, 0.05]" :cast-shadow="shadows">
      <TresSphereGeometry :args="[0.24, 20, 20]" />
      <TresMeshStandardMaterial :color="palette.skin" :roughness="0.58" :metalness="0" />
    </TresMesh>

    <!-- BasicMaterial: lit Standard washed faces out under salon lighting -->
    <TresMesh
      :key="faceKey"
      :position="[0, 1.84, 0.28]"
      :scale="[0.52, 0.62, 1]"
    >
      <TresCircleGeometry :args="[0.5, 28]" />
      <TresMeshBasicMaterial
        v-if="hasFace"
        color="#ffffff"
        :map="faceMap"
        :tone-mapped="false"
      />
      <TresMeshStandardMaterial
        v-else
        :color="palette.skin"
        :roughness="0.55"
        :metalness="0"
      />
    </TresMesh>

    <template v-if="!hasFace">
      <TresMesh :position="[-0.08, 1.84, 0.26]">
        <TresSphereGeometry :args="[0.032, 10, 10]" />
        <TresMeshStandardMaterial color="#1a100c" :roughness="0.7" :metalness="0" />
      </TresMesh>
      <TresMesh :position="[0.08, 1.84, 0.26]">
        <TresSphereGeometry :args="[0.032, 10, 10]" />
        <TresMeshStandardMaterial color="#1a100c" :roughness="0.7" :metalness="0" />
      </TresMesh>
      <TresMesh :position="[0, 1.74, 0.27]">
        <TresBoxGeometry :args="[0.07, 0.015, 0.02]" />
        <TresMeshStandardMaterial color="#8a5a40" :roughness="0.7" :metalness="0" />
      </TresMesh>
    </template>

    <TresMesh :position="[0, 1.96, -0.04]" :scale="[1.12, 0.72, 1.15]">
      <TresSphereGeometry :args="[0.25, 16, 16]" />
      <TresMeshStandardMaterial :color="palette.hair" :roughness="0.88" :metalness="0" />
    </TresMesh>
    <TresMesh :position="[0, 1.86, -0.16]" :scale="[1.05, 0.85, 0.7]">
      <TresSphereGeometry :args="[0.22, 14, 14]" />
      <TresMeshStandardMaterial :color="palette.hair" :roughness="0.88" :metalness="0" />
    </TresMesh>

    <TresGroup v-if="accessory === 'glasses'" :position="[0, 1.86, 0.32]">
      <TresMesh :position="[-0.09, 0, 0]">
        <TresTorusGeometry :args="[0.065, 0.011, 8, 16]" />
        <TresMeshStandardMaterial :color="accent" :roughness="0.3" :metalness="0.8" />
      </TresMesh>
      <TresMesh :position="[0.09, 0, 0]">
        <TresTorusGeometry :args="[0.065, 0.011, 8, 16]" />
        <TresMeshStandardMaterial :color="accent" :roughness="0.3" :metalness="0.8" />
      </TresMesh>
      <TresMesh>
        <TresBoxGeometry :args="[0.05, 0.012, 0.012]" />
        <TresMeshStandardMaterial :color="accent" :roughness="0.3" :metalness="0.8" />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
