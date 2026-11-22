<script setup lang="ts">
/**
 * Table button: a wood and brass plaque standing on a thicker step, which
 * sinks when pressed (with a short vibration on phones). Colours follow the
 * table: wood, gold (main action), cloth, wine, ink.
 */
const props = withDefaults(defineProps<{
  label?: string
  icon?: string
  trailingIcon?: string
  variant?: 'wood' | 'gold' | 'felt' | 'wine' | 'ink'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  block?: boolean
  /** Chosen option: stays pressed in. */
  active?: boolean
  /** 0..1: a gauge along the bottom (countdowns). */
  progress?: number | null
  type?: 'button' | 'submit'
  to?: string
}>(), {
  variant: 'wood',
  size: 'md',
  type: 'button',
  progress: null
})

const emit = defineEmits<{ click: [event: MouseEvent] }>()

function onPress() {
  if (props.disabled || props.loading) {
    return
  }
  try {
    navigator.vibrate?.(8)
  } catch {
    // Not supported: no vibration.
  }
}

function onClick(event: MouseEvent) {
  if (props.disabled || props.loading) {
    event.preventDefault()
    return
  }
  emit('click', event)
}

const tag = computed(() => props.to ? resolveComponent('NuxtLink') : 'button')
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :type="to ? undefined : type"
    class="game-btn"
    :class="[`game-btn--${variant}`, `game-btn--${size}`, { 'game-btn--block': block, 'game-btn--active': active, 'game-btn--disabled': disabled || loading }]"
    :disabled="to ? undefined : (disabled || loading)"
    :aria-pressed="active || undefined"
    @pointerdown="onPress"
    @click="onClick"
  >
    <UIcon
      v-if="loading"
      name="i-lucide-loader-circle"
      class="game-btn__icon animate-spin"
    />
    <UIcon
      v-else-if="icon"
      :name="icon"
      class="game-btn__icon"
    />
    <span
      v-if="label || $slots.default"
      class="truncate"
    ><slot>{{ label }}</slot></span>
    <UIcon
      v-if="trailingIcon"
      :name="trailingIcon"
      class="game-btn__icon"
    />
    <span
      v-if="progress != null"
      class="game-btn__gauge"
    ><i :style="{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }" /></span>
  </component>
</template>

<style scoped>
.game-btn {
  --face-1: #5a3822;
  --face-2: #3a2314;
  --step: #1f1209;
  --rim: #c9a463;
  --ink: #f6e7c4;
  --ink-shadow: rgba(0, 0, 0, 0.55);
  --gloss: rgba(255, 255, 255, 0.18);
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-width: 0;
  white-space: nowrap;
  border-radius: 10px;
  border: 1.5px solid var(--rim);
  background: linear-gradient(var(--face-1), var(--face-2));
  color: var(--ink);
  font-weight: 800;
  letter-spacing: 0.01em;
  text-shadow: 0 1px 0 var(--ink-shadow);
  box-shadow:
    0 4px 0 var(--step),
    0 7px 14px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 var(--gloss),
    inset 0 -2px 0 rgba(0, 0, 0, 0.18);
  transform: translateY(0);
  transition: transform 90ms ease-out, box-shadow 90ms ease-out, filter 150ms ease-out;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.game-btn:hover:not(.game-btn--disabled) { filter: brightness(1.08); }
.game-btn:focus-visible { outline: 2px solid #ffe7a8; outline-offset: 3px; }
.game-btn:active:not(.game-btn--disabled),
.game-btn--active {
  transform: translateY(3px);
  box-shadow:
    0 1px 0 var(--step),
    0 3px 6px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 var(--gloss),
    inset 0 2px 6px rgba(0, 0, 0, 0.25);
}
.game-btn--disabled { cursor: not-allowed; filter: grayscale(0.5) brightness(0.7); }

.game-btn--sm { height: 32px; padding: 0 0.8rem; font-size: 0.8rem; border-radius: 8px; }
.game-btn--md { height: 40px; padding: 0 1.1rem; font-size: 0.9rem; }
.game-btn--lg { height: 48px; padding: 0 1.4rem; font-size: 1.02rem; border-radius: 12px; }
.game-btn--block { display: flex; width: 100%; }
.game-btn__icon { width: 1.1em; height: 1.1em; flex-shrink: 0; }

.game-btn--gold {
  --face-1: #f6d98c;
  --face-2: #c9922f;
  --step: #7c5414;
  --rim: #fff0c4;
  --ink: #3a2208;
  --ink-shadow: rgba(255, 240, 200, 0.6);
  --gloss: rgba(255, 255, 255, 0.6);
}
.game-btn--felt { --face-1: #3f7a57; --face-2: #24513a; --step: #11291c; --gloss: rgba(255, 255, 255, 0.2); }
.game-btn--wine { --face-1: #9b3340; --face-2: #6a1e28; --step: #3a0e14; --gloss: rgba(255, 255, 255, 0.2); }
.game-btn--ink { --face-1: #35507e; --face-2: #1f3254; --step: #0f1a2e; --gloss: rgba(255, 255, 255, 0.2); }

.game-btn__gauge {
  position: absolute;
  left: 9px;
  right: 9px;
  bottom: 4px;
  height: 3px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.2);
  overflow: hidden;
}
.game-btn__gauge i {
  display: block;
  height: 100%;
  background: currentColor;
  opacity: 0.6;
  transform-origin: left;
  transition: transform 250ms linear;
}
</style>
