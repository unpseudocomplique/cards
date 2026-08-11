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
        clear-color="#12160f"
        class="h-full w-full touch-none"
        :dpr="settings.dprCap"
        :render-mode="'always'"
        :shadows="settings.shadows"
        @loop="onLoop"
      >
        <TresPerspectiveCamera
          :position="[0, 4.2, 5.2]"
          :look-at="[0, 0, 0.2]"
        />
        <TresAmbientLight :intensity="settings.lights === 2 ? 0.55 : 0.75" />
        <TresDirectionalLight
          :position="[2, 6, 3]"
          :intensity="0.85"
          :cast-shadow="settings.shadows"
        />
        <TresDirectionalLight
          v-if="settings.lights === 2"
          :position="[-3, 4, -2]"
          :intensity="0.35"
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
          :position="[0, 0.06, -0.9]"
        >
          <PlayTresCardMesh
            v-for="(card, index) in publicState.chienRevealed"
            :key="`chien-${card}`"
            :card-id="card"
            :face="textures.getFace(card)"
            :back="textures.getBack()"
            face-up
            :position="[(index - (publicState.chienRevealed.length - 1) / 2) * 0.45, 0, 0]"
            :rotation="[-Math.PI / 2, 0, 0]"
          />
        </TresGroup>
      </TresCanvas>
    </ClientOnly>

    <div
      v-if="debugGfx"
      class="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white"
    >
      {{ profile }} · {{ fps }} fps · tex {{ textures.faces.size }}
    </div>

    <div
      v-if="textures.loading"
      class="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-white/80"
    >
      Chargement des textures…
    </div>
  </div>
</template>
