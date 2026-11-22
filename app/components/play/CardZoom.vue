<script setup lang="ts">
import { tarotCardLabel } from '~/utils/tarotCardLabel'

const { zoom, close } = useCardZoom()

const label = computed(() => zoom.value ? tarotCardLabel(zoom.value.card) : null)

onKeyStroke('Escape', () => {
  if (zoom.value) {
    close()
  }
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition duration-100 ease-in"
    leave-to-class="opacity-0"
  >
    <div
      v-if="zoom"
      class="absolute inset-0 z-[90] grid place-items-center bg-black/60 p-6 backdrop-blur-[2px]"
      :class="zoom.mode === 'hold' ? 'pointer-events-none' : 'pointer-events-auto cursor-zoom-out'"
      role="dialog"
      :aria-label="`Carte agrandie : ${label?.shortLabel ?? ''}`"
      @click="close"
    >
      <div
        :key="zoom.card"
        class="animate-[zoom-in_160ms_ease-out] h-[min(68vh,34rem)] max-w-full short:h-[82vh]"
        :style="{ aspectRatio: 'var(--table-card-ratio, 2 / 3)' }"
      >
        <PlayDeckCard
          :card-id="zoom.card"
          :face-url="zoom.faceUrl"
          fill
          :index-px="28"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
@keyframes zoom-in {
  from {
    transform: scale(0.85);
    opacity: 0.4;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
