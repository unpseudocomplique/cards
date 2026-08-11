<script setup lang="ts">
import type { CardId, PrivateGameView, PublicGameView } from '~~/shared/tarot'

const props = defineProps<{
  code: string
  publicState: PublicGameView
  privateState: PrivateGameView | null
  debugGfx?: boolean
}>()

const emit = defineEmits<{
  play: [card: CardId]
}>()

const { settings, noteFpsSample, profile } = usePlayQuality()
const textures = useCardTextures(toRef(props, 'code'), settings)

const localSeat = computed(() => props.privateState?.seat ?? 0)
const fps = shallowRef(0)
let frames = 0
let lastTs = 0

const showLoading = computed(() => textures.loading && textures.faces.size < 8)

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
        :dpr="settings.dprCap"
        :render-mode="'always'"
        :shadows="settings.shadows"
        @loop="onLoop"
      >
        <TresPerspectiveCamera
          :position="[0, 3.15, 4.35]"
          :look-at="[0, 0, 0.35]"
          :fov="42"
        />

        <TresHemisphereLight :args="['#e8dcc8', '#102018', 0.55]" />
        <TresAmbientLight :intensity="settings.lights === 2 ? 0.28 : 0.4" />
        <TresDirectionalLight
          :position="[3.2, 7.5, 2.4]"
          :intensity="1.15"
          :cast-shadow="settings.shadows"
          color="#fff1dd"
        />
        <TresDirectionalLight
          v-if="settings.lights === 2"
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

        <PlayTresTrickPile
          :trick="publicState.trick"
          :get-face="textures.getFace"
          :get-back="textures.getBack"
        />

        <PlayTresHandFan
          v-if="privateState?.hand?.length"
          :cards="privateState.hand"
          :legal-moves="privateState.legalMoves"
          :get-face="textures.getFace"
          :get-back="textures.getBack"
          @play="emit('play', $event)"
        />

        <TresGroup
          v-if="publicState.chienRevealed?.length"
          :position="[0, 0.04, -1.05]"
        >
          <PlayTresCardMesh
            v-for="(card, index) in publicState.chienRevealed"
            :key="`chien-${card}`"
            :card-id="card"
            :face="textures.getFace(card)"
            :back="textures.getBack()"
            face-up
            :position="[(index - (publicState.chienRevealed.length - 1) / 2) * 0.42, 0, 0]"
            :rotation="[0, (index - 1) * 0.04, 0]"
          />
        </TresGroup>
      </TresCanvas>
    </ClientOnly>

    <div
      v-if="debugGfx"
      class="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 font-mono text-[11px] text-white/90"
    >
      {{ profile }} · {{ fps }} fps · tex {{ textures.faces.size }}
    </div>

    <div
      v-if="showLoading"
      class="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-white/5"
    >
      <div class="h-full w-1/3 animate-pulse bg-amber-200/70" />
    </div>
  </div>
</template>
