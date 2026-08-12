<script setup lang="ts">
/**
 * Mounts one of the 10 procedural salon cast factories into the Tres scene.
 */
import type { Group } from 'three'
import { createSalonCastModel } from '~/components/play/tres/salon-cast'

const props = withDefaults(defineProps<{
  characterId: string
  shadows?: boolean
}>(), {
  shadows: false
})

const object = shallowRef<Group | null>(null)

function mount() {
  disposeCurrent()
  if (!import.meta.client || !props.characterId) {
    return
  }
  try {
    object.value = createSalonCastModel(props.characterId, { shadows: props.shadows })
  } catch (error) {
    console.warn('[salon] cast model failed', props.characterId, error)
  }
}

function disposeCurrent() {
  const current = object.value
  object.value = null
  if (!current) {
    return
  }
  current.userData.sculptRuntime?.dispose?.()
  current.removeFromParent()
}

watch(
  () => [props.characterId, props.shadows] as const,
  () => {
    mount()
  },
  { immediate: true }
)

onUnmounted(() => {
  disposeCurrent()
})
</script>

<template>
  <primitive
    v-if="object"
    :key="characterId"
    :object="object"
  />
</template>
