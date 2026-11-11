<script setup lang="ts">
import type { CardThemeId } from '~~/shared/utils/cardThemes'
import { cardThemeOptions } from '~~/shared/utils/cardThemes'

const model = defineModel<CardThemeId>({ required: true })

defineProps<{
  disabled?: boolean
}>()
</script>

<template>
  <div
    class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
    role="radiogroup"
    aria-label="Thème de couleurs"
  >
    <button
      v-for="theme in cardThemeOptions"
      :key="theme.id"
      type="button"
      role="radio"
      :aria-checked="model === theme.id"
      :disabled="disabled"
      class="flex items-start gap-3 rounded-xl border p-3 text-left transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
      :class="model === theme.id
        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
        : 'border-default bg-elevated/20'"
      @click="model = theme.id"
    >
      <span
        class="relative mt-0.5 h-12 w-9 shrink-0 overflow-hidden rounded-md shadow-sm"
        :style="{ backgroundColor: theme.colors.paper, boxShadow: `inset 0 0 0 2px ${theme.colors.frame}` }"
        aria-hidden="true"
      >
        <span
          class="absolute inset-x-2 inset-y-2.5 rounded-[3px]"
          :style="{ backgroundColor: theme.colors.frame }"
        />
        <span
          class="absolute top-1 left-1 size-1.5 rounded-full"
          :style="{ backgroundColor: theme.colors.redInk }"
        />
        <span
          class="absolute right-1 bottom-1 size-1.5 rounded-full"
          :style="{ backgroundColor: theme.colors.hairline }"
        />
      </span>
      <span class="min-w-0">
        <span class="block text-sm font-semibold text-highlighted">{{ theme.label }}</span>
        <span class="mt-0.5 block text-xs text-pretty text-muted">{{ theme.description }}</span>
      </span>
    </button>
  </div>
</template>
