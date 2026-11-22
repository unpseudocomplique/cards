<script setup lang="ts">
/** Round brass-rimmed button for the corners of the table (leave, reactions, settings). */
withDefaults(defineProps<{
  icon: string
  label: string
  active?: boolean
}>(), { active: false })

defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button
    type="button"
    class="round-btn"
    :class="{ 'round-btn--active': active }"
    :aria-label="label"
    :title="label"
    @click="$emit('click', $event)"
  >
    <UIcon
      :name="icon"
      class="size-[18px]"
    />
  </button>
</template>

<style scoped>
.round-btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  color: #f6e7c4;
  background: radial-gradient(circle at 35% 30%, #4a3424, #24170e 72%);
  box-shadow:
    0 0 0 2px #c9a463,
    0 0 0 3.5px #3a2512,
    0 5px 10px rgba(0, 0, 0, 0.55),
    inset 0 2px 2px rgba(255, 255, 255, 0.16);
  transition: transform 120ms ease-out, filter 150ms;
  -webkit-tap-highlight-color: transparent;
}
.round-btn:hover { filter: brightness(1.12); }
.round-btn:active, .round-btn--active { transform: scale(0.93); }
.round-btn:focus-visible { outline: 2px solid #ffe7a8; outline-offset: 4px; }
</style>
