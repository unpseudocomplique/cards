<script setup lang="ts">
import type { Texture } from 'three'

const props = defineProps<{
  handCounts: number[]
  localSeat: number
  playerCount: 3 | 4 | 5
  getBack: () => Texture | null
  names?: Array<string | null>
}>()

function stackForSeat(seat: number) {
  if (seat === props.localSeat) {
    return []
  }
  const count = Math.min(props.handCounts[seat] ?? 0, 10)
  return Array.from({ length: count }, (_, i) => i)
}

function seatPose(seat: number): { position: [number, number, number], yaw: number } {
  const count = props.playerCount
  const radius = 2.7
  const rel = (seat - props.localSeat + count) % count
  // Keep local seat toward camera (+Z), opponents around the oval
  const angle = Math.PI / 2 + (rel / count) * Math.PI * 2
  return {
    position: [Math.cos(angle) * radius, 0.05, Math.sin(angle) * radius],
    yaw: angle + Math.PI / 2,
  }
}
</script>

<template>
  <TresGroup>
    <TresGroup
      v-for="(_, seat) in handCounts"
      :key="seat"
      :position="seatPose(seat).position"
      :rotation="[0, seatPose(seat).yaw, 0]"
    >
      <PlayTresCardMesh
        v-for="layer in stackForSeat(seat)"
        :key="`${seat}-${layer}`"
        card-id="back"
        :face="null"
        :back="getBack()"
        :face-up="false"
        :position="[(layer - 4) * 0.02, layer * 0.014, 0]"
        :rotation="[0.05, 0, (layer - 4) * 0.01]"
      />
    </TresGroup>
  </TresGroup>
</template>
