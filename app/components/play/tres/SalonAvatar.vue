<script setup lang="ts">
/**
 * Mounts one of the 10 img2threejs-style salon cast factories into the Tres scene.
 */
import type { Group } from 'three'
import { createSalonCastModel } from '~/components/play/tres/salon-cast'

const props = withDefaults(defineProps<{
  characterId: string
  shadows?: boolean
}>(), {
  shadows: false,
})

const object = shallowRef<Group | null>(null)
let gen = 0

async function mount() {
  const g = ++gen
  disposeCurrent()
  if (!import.meta.client || !props.characterId) {
    return
  }
  try {
    const model = await createSalonCastModel(props.characterId, { shadows: props.shadows })
    if (g !== gen) {
      model.userData.sculptRuntime?.dispose?.()
      return
    }
    object.value = model
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
    void mount()
  },
  { immediate: true },
)

onUnmounted(() => {
  gen++
  disposeCurrent()
})
</script>

<template>
  <primitive
    v-if="object"
    :object="object"
  />
</template>
