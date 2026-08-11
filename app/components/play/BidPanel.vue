<script setup lang="ts">
import type { Contract } from '~~/shared/tarot'

defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  bid: [bid: Contract | 'passe']
}>()

const bids: Array<{ value: Contract | 'passe', label: string, color: 'neutral' | 'primary' | 'warning' | 'error' }> = [
  { value: 'passe', label: 'Passe', color: 'neutral' },
  { value: 'prise', label: 'Prise', color: 'primary' },
  { value: 'garde', label: 'Garde', color: 'primary' },
  { value: 'garde_sans', label: 'Garde sans', color: 'warning' },
  { value: 'garde_contre', label: 'Garde contre', color: 'error' },
]
</script>

<template>
  <UCard>
    <template #header>
      <p class="font-semibold text-highlighted">
        Enchères
      </p>
      <p class="text-sm text-muted">
        Choisissez votre annonce.
      </p>
    </template>

    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="item in bids"
        :key="item.value"
        :color="item.color"
        variant="soft"
        :disabled="disabled"
        @click="emit('bid', item.value)"
      >
        {{ item.label }}
      </UButton>
    </div>
  </UCard>
</template>
