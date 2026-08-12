<script setup lang="ts">
import type { Texture } from 'three'

const props = defineProps<{
  handCounts: number[]
  localSeat: number
  playerCount: 3 | 4 | 5
  getBack: () => Texture | null
}>()

function stackForSeat(seat: number) {
  if (seat === props.localSeat) {
    return []
  }
  const count = Math.min(props.handCounts[seat] ?? 0, 9)
  return Array.from({ length: count }, (_, i) => i)
}

function seatPose(seat: number): { position: [number, number, number], yaw: number } {
  const count = props.playerCount
  // Keep opponent hands near the rim, not under the center trick.
  const radius = 3.05
  const rel = (seat - props.localSeat + count) % count
  const angle = Math.PI / 2 + (rel / count) * Math.PI * 2
  return {
    position: [Math.cos(angle) * radius, 0.04, Math.sin(angle) * radius],
    yaw: angle + Math.PI,
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
      <!-- Compact overlapping backs, flat on felt -->
      <PlayTresCardMesh
        v-for="layer in stackForSeat(seat)"
        :key="`${seat}-${layer}`"
        card-id="back"
        :face="null"
        :back="getBack()"
        :face-up="false"
        :position="[(layer - 4) * 0.018, layer * 0.007, layer * 0.004]"
        :rotation="[0, 0, (layer - 4) * 0.015]"
      />
    </TresGroup>
  </TresGroup>
</template>
