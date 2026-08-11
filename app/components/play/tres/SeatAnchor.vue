<script setup lang="ts">
const props = defineProps<{
  playerCount: 3 | 4 | 5
  localSeat: number
}>()

/** World anchors: local seat forced to bottom (-Z). */
const anchors = computed(() => {
  const count = props.playerCount
  const radius = 2.55
  const out: Array<{ seat: number, position: [number, number, number], yaw: number }> = []
  for (let seat = 0; seat < count; seat++) {
    const rel = (seat - props.localSeat + count) % count
    // 0 = local (bottom), then clockwise
    const angle = Math.PI / 2 + (rel / count) * Math.PI * 2
    out.push({
      seat,
      position: [Math.cos(angle) * radius, 0.02, Math.sin(angle) * radius],
      yaw: angle + Math.PI / 2,
    })
  }
  return out
})

defineExpose({ anchors })
</script>

<template>
  <TresGroup>
    <TresGroup
      v-for="anchor in anchors"
      :key="anchor.seat"
      :position="anchor.position"
      :rotation="[0, -anchor.yaw, 0]"
    >
      <slot
        :seat="anchor.seat"
        :is-local="anchor.seat === localSeat"
      />
    </TresGroup>
  </TresGroup>
</template>
