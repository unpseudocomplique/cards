<script setup lang="ts">
import type { Group } from 'three'
import { SALON_CAST_FACTORIES, type SalonCastId } from '~/components/play/tres/salon-cast'
import { SALON_SCULPT_SPECS } from '~/utils/salonSculpt/specs'

definePageMeta({
  layout: false
})

useSeoMeta({
  title: 'Salon cast — validation 3D'
})

const CAST_IDS = Object.keys(SALON_CAST_FACTORIES) as SalonCastId[]

const selectedId = shallowRef<SalonCastId>('aurelien')
const view = shallowRef<'front' | 'three-quarter' | 'profile' | 'back'>('three-quarter')
const spinning = shallowRef(false)
const object = shallowRef<Group | null>(null)
const orbitAngle = shallowRef(Math.atan2(1.62, 2.42))

const spec = computed(() => SALON_SCULPT_SPECS[selectedId.value]!)

const cameraPosition = computed<[number, number, number]>(() => {
  if (spinning.value) {
    const a = orbitAngle.value
    return [
      Math.sin(a) * 3.05,
      1.2,
      0.06 + Math.cos(a) * 3.05
    ]
  }
  switch (view.value) {
    case 'front':
      return [0, 1.12, 3.1]
    case 'profile':
      return [3.05, 1.12, 0.4]
    case 'back':
      return [0, 1.18, -3.1]
    default:
      return [1.62, 1.18, 2.42]
  }
})

const cameraLookAt = computed<[number, number, number]>(() => {
  void cameraPosition.value
  return [0, 0.72, 0.06]
})

function mount(id: SalonCastId) {
  const current = object.value
  if (current) {
    current.userData.sculptRuntime?.dispose?.()
    current.removeFromParent()
  }
  object.value = null
  if (!import.meta.client) {
    return
  }
  const model = SALON_CAST_FACTORIES[id]({ shadows: true })
  model.rotation.y = 0
  object.value = model
}

watch(selectedId, (id) => {
  mount(id)
}, { immediate: true })

onUnmounted(() => {
  object.value?.userData.sculptRuntime?.dispose?.()
  object.value = null
})

function onLoop({ delta }: { delta?: number }) {
  if (spinning.value) {
    orbitAngle.value += (typeof delta === 'number' ? delta : 0.016) * 0.55
  }
}

function select(id: SalonCastId) {
  selectedId.value = id
}

function setView(next: typeof view.value) {
  spinning.value = false
  const [x, , z] = cameraPosition.value
  orbitAngle.value = Math.atan2(x, z - 0.06)
  view.value = next
}
</script>

<template>
  <div class="relative min-h-dvh overflow-hidden bg-[#120e0c] text-[#efe6d8]">
    <ClientOnly>
      <TresCanvas
        clear-color="#120e0c"
        class="absolute inset-0 h-full w-full"
        :dpr="1.5"
        shadows
        render-mode="always"
        @loop="onLoop"
      >
        <TresPerspectiveCamera
          :position="cameraPosition"
          :look-at="cameraLookAt"
          :fov="36"
        />
        <TresHemisphereLight :args="['#ffe8d0', '#4a2818', 1.15]" />
        <TresAmbientLight :intensity="1.05" />
        <TresDirectionalLight
          :position="[2.4, 4.2, 3.2]"
          :intensity="0.85"
          color="#ffe2b8"
          cast-shadow
        />
        <TresDirectionalLight
          :position="[-2.2, 2.6, -3.4]"
          :intensity="0.95"
          color="#d4c4b0"
        />
        <TresPointLight
          :position="[0, 2.2, 1.4]"
          color="#ffd7a8"
          :intensity="0.4"
          :distance="10"
          :decay="2"
        />
        <TresMesh
          :rotation="[-Math.PI / 2, 0, 0]"
          :position="[0, 0, 0]"
          receive-shadow
        >
          <TresCircleGeometry :args="[4.5, 48]" />
          <TresMeshStandardMaterial color="#2a1c16" :roughness="0.85" :metalness="0.04" />
        </TresMesh>
        <primitive
          v-if="object"
          :key="selectedId"
          :object="object"
        />
      </TresCanvas>
    </ClientOnly>

    <div class="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      <header class="pointer-events-auto flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] uppercase tracking-[0.22em] text-[#e0c06a]/80">
            Salon cast
          </p>
          <h1 class="mt-1 font-serif text-3xl tracking-tight text-[#f2e6c8]">
            {{ spec.displayName }}
          </h1>
          <p class="mt-1 max-w-sm text-sm text-white/55">
            Volume 3D sculpté — smoking, lunettes, barbe, fauteuil. Pas un collage.
          </p>
        </div>
        <img
          :src="spec.portraitUrl"
          :alt="`Reference ${spec.displayName}`"
          class="h-44 w-32 rounded-sm object-cover ring-1 ring-[#e0c06a]/40"
        >
      </header>

      <div class="pointer-events-auto flex flex-wrap items-end justify-between gap-3">
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="id in CAST_IDS"
            :key="id"
            type="button"
            class="rounded-sm px-2.5 py-1.5 text-xs tracking-wide ring-1 transition"
            :class="id === selectedId
              ? 'bg-[#e0c06a] text-[#1a120c] ring-[#e0c06a]'
              : 'bg-black/40 text-[#efe6d8] ring-white/15 hover:ring-[#e0c06a]/50'"
            @click="select(id)"
          >
            {{ SALON_SCULPT_SPECS[id]?.displayName }}
          </button>
        </div>
        <div class="flex gap-1.5">
          <button
            v-for="item in ([
              ['front', 'Face'],
              ['three-quarter', '3/4'],
              ['profile', 'Profil'],
              ['back', 'Dos']
            ] as const)"
            :key="item[0]"
            type="button"
            class="rounded-sm px-2.5 py-1.5 text-xs ring-1 transition"
            :class="view === item[0] && !spinning
              ? 'bg-white/15 ring-white/40'
              : 'bg-black/40 ring-white/15 hover:ring-white/30'"
            @click="setView(item[0])"
          >
            {{ item[1] }}
          </button>
          <button
            type="button"
            class="rounded-sm px-2.5 py-1.5 text-xs ring-1 transition"
            :class="spinning ? 'bg-[#e0c06a] text-[#1a120c] ring-[#e0c06a]' : 'bg-black/40 ring-white/15'"
            @click="spinning = !spinning"
          >
            Plateau
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
