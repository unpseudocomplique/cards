<script setup lang="ts">
import { getCardTheme } from '~~/shared/utils/cardThemes'
import { cardFormatRatio, resolveDeckCardFormat } from '~~/shared/utils/printSpec'

/** Three fanned cards: the deck's best faces, or themed blanks while it is empty. */
const props = defineProps<{
  urls?: string[]
  themeId?: string | null
  /** Deck card format (absent = poker, decks created before formats). */
  formatId?: string | null
}>()

const theme = computed(() => getCardTheme(props.themeId))
const format = computed(() => resolveDeckCardFormat({ cardFormat: props.formatId }))
const slots = computed(() => [0, 1, 2].map(index => props.urls?.[index] ?? null))
const placeholderGlyphs = ['♥', '✦', '♠']
</script>

<template>
  <div
    class="relative flex items-end justify-center overflow-hidden"
    :style="{ background: `radial-gradient(80% 90% at 50% 100%, color-mix(in oklab, ${theme.colors.frame} 55%, transparent), transparent 70%)` }"
  >
    <div class="relative w-[30%] translate-y-[14%]">
      <div
        v-for="(url, index) in slots"
        :key="index"
        class="transition-transform duration-500 ease-out"
        :class="[
          index === 1 ? 'relative z-10' : 'absolute inset-0',
          index === 0 ? '-translate-x-[52%] -rotate-[11deg] group-hover:-translate-x-[62%] group-hover:-rotate-[15deg]' : '',
          index === 2 ? 'translate-x-[52%] rotate-[11deg] group-hover:translate-x-[62%] group-hover:rotate-[15deg]' : '',
          index === 1 ? 'group-hover:-translate-y-[4%]' : ''
        ]"
      >
        <img
          v-if="url"
          :src="url"
          alt=""
          class="w-full rounded-[5%] object-cover shadow-lg shadow-black/30"
          :style="{ aspectRatio: String(cardFormatRatio(format)) }"
          loading="lazy"
        >
        <CardArt
          v-else
          :theme="theme"
          :format="format.id"
          :glyph="placeholderGlyphs[index]"
          class="shadow-lg shadow-black/20"
        />
      </div>
    </div>
  </div>
</template>
