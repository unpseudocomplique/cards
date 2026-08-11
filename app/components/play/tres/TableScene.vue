<script setup lang="ts">
import type { CardId, PrivateGameView, PublicGameView } from '~~/shared/tarot'

const props = defineProps<{
  code: string
  publicState: PublicGameView
  privateState: PrivateGameView | null
  debugGfx?: boolean
  showHand?: boolean
}>()

const emit = defineEmits<{
  play: [card: CardId]
}>()

const { settings, noteFpsSample, profile } = usePlayQuality()
const textures = useCardTextures(toRef(props, 'code'), settings)
const isMobile = useMediaQuery('(max-width: 640px)')

const localSeat = computed(() => props.privateState?.seat ?? 0)
const fps = shallowRef(0)
let frames = 0
let lastTs = 0

const showLoading = computed(() => textures.loading.value && textures.faces.value.size < 4)

const canInteractHand = computed(() => {
  const phase = props.publicState.phase
  if (phase !== 'Trick' && phase !== 'ReadyToPlay') {
    return false
  }
  if (!props.privateState) {
    return false
  }
  return props.publicState.currentSeat === props.privateState.seat
    && (props.privateState.legalMoves?.length ?? 0) > 0
})

const faceUrlMap = computed(() => {
  const map = new Map<string, string | null>()
  for (const card of textures.manifest.value?.cards ?? []) {
    map.set(card.cardCode, card.faceUrl)
  }
  return map
})

const backUrl = computed(() => textures.manifest.value?.backUrl ?? null)

const cameraPosition = computed<[number, number, number]>(() =>
  isMobile.value ? [0, 4.1, 5.4] : [0, 3.55, 4.85],
)

const priorityCodes = computed(() => {
  const codes = new Set<string>()
  for (const card of props.privateState?.hand ?? []) {
    codes.add(card)
  }
  for (const entry of props.publicState.trick ?? []) {
    codes.add(entry.card)
  }
  for (const card of props.publicState.chienRevealed ?? []) {
    codes.add(card)
  }
  return [...codes]
})

watch(priorityCodes, (codes) => {
  textures.prioritize(codes)
}, { immediate: true })

function onLoop({ delta }: { delta: number }) {
  const dt = delta * 1000
  frames++
  lastTs += dt
  if (lastTs >= 500) {
    const sample = (frames / lastTs) * 1000
    fps.value = Math.round(sample)
    noteFpsSample(sample, lastTs)
    frames = 0
    lastTs = 0
  }
}

onUnmounted(() => {
  textures.disposeAll()
})
</script>

<template>
  <div class="relative h-full w-full">
    <ClientOnly>
      <TresCanvas
        clear-color="#0a0f0c"
        class="h-full w-full touch-none"
        :dpr="isMobile ? Math.min(settings.dprCap, 1.15) : settings.dprCap"
        :render-mode="'always'"
        :shadows="!isMobile && settings.shadows"
        @loop="onLoop"
      >
        <TresPerspectiveCamera
          :position="cameraPosition"
          :look-at="[0, 0, 0.05]"
          :fov="isMobile ? 44 : 38"
        />

        <TresHemisphereLight :args="['#e8dcc8', '#102018', 0.55]" />
        <TresAmbientLight :intensity="settings.lights === 2 ? 0.28 : 0.4" />
        <TresDirectionalLight
          :position="[3.2, 7.5, 2.4]"
          :intensity="1.15"
          :cast-shadow="!isMobile && settings.shadows"
          color="#fff1dd"
        />
        <TresDirectionalLight
          v-if="settings.lights === 2 && !isMobile"
          :position="[-4, 3.5, -2.5]"
          :intensity="0.35"
          color="#9eb6ff"
        />
        <TresPointLight
          :position="[0, 2.8, 0.4]"
          :intensity="0.55"
          color="#ffd7a8"
          :distance="10"
        />

        <PlayTresTableFelt />

        <PlayTresOpponentStacks
          :hand-counts="publicState.handCounts"
          :local-seat="localSeat"
          :player-count="publicState.playerCount"
          :get-back="textures.getBack"
        />
      </TresCanvas>
    </ClientOnly>

    <!-- Same DeckCard art as the hand -->
    <PlayTrickOverlay
      v-if="publicState.trick?.length"
      :trick="publicState.trick"
      :face-urls="faceUrlMap"
      :seats="publicState.seats"
    />

    <PlayChienOverlay
      v-if="publicState.chienRevealed?.length"
      :cards="publicState.chienRevealed"
      :face-urls="faceUrlMap"
    />

    <div
      v-if="showHand !== false && privateState?.hand?.length"
      class="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-1 pb-3 sm:px-2 sm:pb-5"
    >
      <PlayHandArc
        :cards="privateState.hand"
        :legal-moves="privateState.legalMoves"
        :face-urls="faceUrlMap"
        :back-url="backUrl"
        :dim-unplayable="canInteractHand"
        @play="emit('play', $event)"
      />
    </div>

    <div
      v-if="debugGfx"
      class="pointer-events-none absolute left-3 top-3 z-30 rounded-md bg-black/60 px-2 py-1 font-mono text-[11px] text-white/90"
    >
      {{ profile }} · {{ fps }} fps · tex {{ textures.faces.size }}
    </div>

    <div
      v-if="showLoading"
      class="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden bg-white/5"
    >
      <div class="h-full w-1/3 animate-pulse bg-amber-200/70" />
    </div>
  </div>
</template>
