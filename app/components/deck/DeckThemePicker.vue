<script setup lang="ts">
import type { CardThemeId } from '~~/shared/utils/cardThemes'
import { cardThemeOptions } from '~~/shared/utils/cardThemes'
import type { CardFormatId } from '~~/shared/utils/printSpec'

const model = defineModel<CardThemeId>({ required: true })

withDefaults(defineProps<{
  disabled?: boolean
  format?: CardFormatId
}>(), {
  format: 'tarot'
})

const glyphs = ['♥', '♠', '♦', '♣', '✦']
</script>

<template>
  <div
    class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
    role="radiogroup"
    aria-label="Thème de couleurs"
  >
    <button
      v-for="(theme, index) in cardThemeOptions"
      :key="theme.id"
      type="button"
      role="radio"
      :aria-checked="model === theme.id"
      :disabled="disabled"
      class="group flex flex-col items-center gap-2.5 rounded-xl p-3 text-center ring transition outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      :class="model === theme.id
        ? 'bg-primary/8 ring-2 ring-primary'
        : 'ring-default hover:bg-elevated/60 hover:ring-accented'"
      @click="model = theme.id"
    >
      <div class="w-14 transition-transform duration-300 group-hover:-rotate-3">
        <CardArt
          :theme="theme"
          :format="format"
          :glyph="glyphs[index % glyphs.length]"
          :index="index % 2 ? 'R♥' : 'D♠'"
          :red="index % 2 === 1"
          class="shadow-md shadow-black/15"
        />
      </div>
      <span>
        <span class="block text-sm font-medium text-highlighted">{{ theme.label }}</span>
        <span class="mt-0.5 line-clamp-2 block text-xs text-pretty text-muted">{{ theme.description }}</span>
      </span>
    </button>
  </div>
</template>
