<script setup lang="ts">
import type { CardId } from '~~/shared/tarot'

const props = defineProps<{
  cardId: CardId
  faceUrl?: string | null
  /** Coordinates relative to the play scene root. */
  from: { left: number, top: number, width: number, height: number }
  /** Where the card lands: centre, height and angle of the card on the felt. */
  to: { x: number, y: number, height: number, rotate: number, fade?: boolean }
}>()

const emit = defineEmits<{
  done: []
}>()

const FLIGHT_MS = 460

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
  // Land exactly where (and as big as) the card on the felt, so the swap is invisible.
  const scale = props.to.height / height

  el.style.left = `${props.from.left}px`
  el.style.top = `${props.from.top}px`
  el.style.width = `${width}px`
  el.style.height = `${height}px`
  el.style.transform = 'translate3d(0, 0, 0) rotate(-10deg) scale(1)'

  void el.offsetWidth

  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)'
  el.style.transition = props.to.fade
    ? `transform ${FLIGHT_MS}ms ${ease}, opacity 140ms ease-out ${FLIGHT_MS - 140}ms`
    : `transform ${FLIGHT_MS}ms ${ease}`
  const dx = props.to.x - (props.from.left + width / 2)
  const dy = props.to.y - (props.from.top + height / 2)
  el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${props.to.rotate}deg) scale(${scale})`
  if (props.to.fade) {
    el.style.opacity = '0'
  }

  el.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'transform') {
      finish()
    }
  })
  doneTimer = setTimeout(finish, FLIGHT_MS + 80)
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
    style="will-change: transform;"
  >
    <div class="h-full w-full overflow-hidden rounded-[5%/calc(5%*var(--table-card-ratio,2/3))] shadow-[0_18px_40px_-8px_rgba(0,0,0,0.85)] [&>div]:h-full! [&>div]:w-full! [&>div]:max-h-full! [&>div]:max-w-full! [&>div]:shadow-none!">
      <PlayDeckCard
        :card-id="cardId"
        :face-url="faceUrl"
        fill
        :index-px="Math.max(10, Math.round(Math.max(from.height, 72) * 0.12))"
      />
    </div>
  </div>
</template>
