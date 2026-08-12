<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'

const props = defineProps<{
  cardId: CardId
  faceUrl?: string | null
  /** Coordinates relative to the play scene root. */
  from: { left: number, top: number, width: number, height: number }
  to: { left: number, top: number }
}>()

const emit = defineEmits<{
  done: []
}>()

const root = ref<HTMLElement | null>(null)
let doneTimer: ReturnType<typeof setTimeout> | null = null

function finish() {
  if (doneTimer) {
    clearTimeout(doneTimer)
    doneTimer = null
  }
  emit('done')
}

onMounted(() => {
  const el = root.value
  if (!el) {
    finish()
    return
  }

  const width = Math.max(props.from.width, 48)
  const height = Math.max(props.from.height, 72)

  el.style.left = `${props.from.left}px`
  el.style.top = `${props.from.top}px`
  el.style.width = `${width}px`
  el.style.height = `${height}px`
  el.style.transform = 'rotate(-14deg) scale(1)'
  el.style.opacity = '1'

  void el.offsetWidth

  el.style.transition = [
    'left 500ms cubic-bezier(0.22, 1, 0.36, 1)',
    'top 500ms cubic-bezier(0.22, 1, 0.36, 1)',
    'transform 500ms cubic-bezier(0.22, 1, 0.36, 1)',
    'opacity 140ms ease-out 380ms',
  ].join(', ')
  el.style.left = `${props.to.left}px`
  el.style.top = `${props.to.top}px`
  el.style.transform = 'rotate(8deg) scale(0.7)'

  doneTimer = setTimeout(finish, 560)
})

onUnmounted(() => {
  if (doneTimer) {
    clearTimeout(doneTimer)
  }
})
</script>

<template>
  <div
    ref="root"
    class="pointer-events-none absolute z-[80] origin-center"
    style="will-change: left, top, transform, opacity;"
  >
    <div class="h-full w-full overflow-hidden rounded-xl shadow-[0_18px_40px_-8px_rgba(0,0,0,0.85)] [&>div]:h-full! [&>div]:w-full! [&>div]:max-h-full! [&>div]:max-w-full! [&>div]:shadow-none!">
      <PlayDeckCard
        :card-id="cardId"
        :face-url="faceUrl"
        size="md"
      />
    </div>
  </div>
</template>
