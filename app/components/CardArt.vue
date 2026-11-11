<script setup lang="ts">
import type { CardTheme } from '~~/shared/utils/cardThemes'
import { getCardTheme } from '~~/shared/utils/cardThemes'
import type { CardFormatId } from '~~/shared/utils/printSpec'
import { CARD_FORMATS, cardFormatRatio, getCardLayoutRatios } from '~~/shared/utils/printSpec'

/**
 * A card drawn in CSS with the same anatomy as the server renderer
 * (server/utils/cardRenderer.ts): both read getCardLayoutRatios(), so the
 * paper, contour, framed window and index corners sit at the same place.
 * Used for placeholders (no image yet) and for illustrations.
 */
const props = withDefaults(defineProps<{
  /** Image shown inside the illustration window. */
  image?: string | null
  /** Corner index, e.g. "R♠", "21" or "EX". */
  index?: string
  /** Large glyph shown when there is no image. */
  glyph?: string
  red?: boolean
  theme?: CardTheme
  format?: CardFormatId
  /** Fade the image (person photo used as a preview, not final art). */
  muted?: boolean
  alt?: string
}>(), {
  image: null,
  index: '',
  glyph: '',
  red: false,
  theme: () => getCardTheme(),
  format: 'tarot',
  muted: false,
  alt: ''
})

const spec = computed(() => CARD_FORMATS[props.format])
const ratio = computed(() => cardFormatRatio(spec.value))
const layout = computed(() => getCardLayoutRatios(spec.value))
const ink = computed(() => props.red ? props.theme.colors.redInk : props.theme.colors.darkInk)

/** Fraction of the card width → container query width units. */
function cqw(value: number) {
  return `${(value * 100).toFixed(3)}cqw`
}

const indexHeight = computed(() => layout.value.rankHeight + layout.value.indexGap + layout.value.pipSize)

/** Window position, mirroring getCardLayout() in the renderer. */
const windowBox = computed(() => {
  const l = layout.value
  const x = l.layout === 'band' ? l.windowX : l.indexX + l.indexWidth + l.windowGap
  const y = l.layout === 'band' ? l.indexY + indexHeight.value + l.windowGap : l.indexY
  return { x, y }
})

const rank = computed(() => {
  if (props.index === 'EX') {
    return '★'
  }
  return props.index.replace(/[♥♦♣♠]/g, '')
})
const pip = computed(() => props.index.match(/[♥♦♣♠]/)?.[0] ?? '')
</script>

<template>
  <!--
    The outer box is the size container (cqw units resolve against it). It gets
    the same rounded corners so shadows / rings passed by the parent follow the card.
  -->
  <div
    class="@container w-full"
    :style="{ borderRadius: `${layout.cardRadius * 100}% / ${layout.cardRadius * 100 * ratio}%` }"
  >
    <div
      class="relative w-full overflow-hidden select-none"
      :style="{
        aspectRatio: String(ratio),
        borderRadius: cqw(layout.cardRadius),
        backgroundColor: theme.colors.paper
      }"
    >
      <!-- Outer contour -->
      <div
        class="absolute"
        :style="{
          inset: cqw(layout.contourInset),
          borderRadius: cqw(layout.contourRadius),
          border: `max(1px, ${cqw(layout.contourStroke)}) solid ${theme.colors.frame}`
        }"
      />

      <!-- Illustration window: frame + hairline -->
      <div
        class="absolute overflow-hidden"
        :style="{
          left: cqw(windowBox.x),
          right: cqw(windowBox.x),
          top: cqw(windowBox.y),
          bottom: cqw(windowBox.y),
          borderRadius: cqw(layout.windowRadius),
          backgroundColor: theme.colors.frame,
          boxShadow: `0 0 0 max(1px, ${cqw(layout.frameStroke / 2)}) ${theme.colors.frame}, 0 0 0 ${cqw(layout.hairlineGap)} ${theme.colors.paper}, 0 0 0 calc(${cqw(layout.hairlineGap)} + max(1px, ${cqw(layout.hairlineStroke)})) ${theme.colors.hairline}`
        }"
      >
        <img
          v-if="image"
          :src="image"
          :alt="alt"
          class="size-full object-cover"
          :class="muted ? 'opacity-45 grayscale-[35%]' : ''"
          loading="lazy"
          draggable="false"
        >
        <div
          v-else
          class="flex size-full items-center justify-center"
        >
          <span
            class="font-display text-[30cqw] leading-none"
            :style="{ color: theme.colors.paper, opacity: 0.85 }"
          >{{ glyph }}</span>
        </div>
        <slot />
      </div>

      <!-- Index corners: top-left, and the same rotated 180° bottom-right -->
      <template v-if="index">
        <span
          v-for="corner in ['top', 'bottom']"
          :key="corner"
          class="absolute flex flex-col items-center leading-none font-bold"
          :class="corner === 'bottom' ? 'rotate-180' : ''"
          :style="{
            width: cqw(layout.indexWidth),
            color: ink,
            ...(corner === 'top'
              ? { left: cqw(layout.indexX), top: cqw(layout.indexY) }
              : { right: cqw(layout.indexX), bottom: cqw(layout.indexY) })
          }"
        >
          <span
            class="tracking-tight"
            :style="{ fontSize: cqw(layout.rankHeight * 1.35) }"
          >{{ rank }}</span>
          <span
            v-if="pip"
            :style="{ fontSize: cqw(layout.pipSize * 1.2), marginTop: cqw(layout.indexGap * 0.5) }"
          >{{ pip }}</span>
        </span>
      </template>
    </div>
  </div>
</template>
