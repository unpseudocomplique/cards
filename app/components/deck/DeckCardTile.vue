<script setup lang="ts">
import type { DeckCard, DeckPerson } from '~/types/deck'
import type { CardTheme } from '~~/shared/utils/cardThemes'
import type { CardFormat } from '~~/shared/utils/printSpec'
import { cardFormatRatio } from '~~/shared/utils/printSpec'
import { cardStatusMeta, cardSuit, suitMeta } from '~/utils/deckLabels'

const props = defineProps<{
  card: DeckCard
  person: DeckPerson | null
  theme: CardTheme
  format: CardFormat
  /** Image rendered in a previous deck format: shown for reference only. */
  outdated?: boolean
  selectable?: boolean
  selected?: boolean
}>()

defineEmits<{
  open: []
  toggle: []
}>()

const suit = computed(() => cardSuit(props.card))
const red = computed(() => Boolean(suit.value && suitMeta[suit.value].red))
const busy = computed(() => props.card.status === 'generating' || props.card.status === 'queued')
const glyph = computed(() => props.card.metadata.shortLabel.replace(/[♥♦♣♠]/g, '') || '✦')
const status = computed(() => cardStatusMeta[props.card.status])
</script>

<template>
  <button
    type="button"
    class="group block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-(--ui-bg)"
    :aria-pressed="selectable ? selected : undefined"
    :aria-label="`${card.metadata.label}, ${status.label}${person ? `, ${person.label}` : ', sans personne'}`"
    @click="selectable ? $emit('toggle') : $emit('open')"
  >
    <div
      class="relative overflow-hidden rounded-[6%] shadow-sm ring-1 transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg"
      :class="[
        selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-(--ui-bg)' : 'ring-black/5 dark:ring-white/5',
        card.status === 'failed' ? 'ring-2 ring-error/70' : ''
      ]"
    >
      <img
        v-if="card.finalImageUrl"
        :src="card.finalImageUrl"
        :alt="card.metadata.label"
        class="w-full"
        :class="[
          outdated ? 'bg-elevated object-contain p-[6%] opacity-55' : 'object-cover',
          busy ? 'opacity-60' : ''
        ]"
        :style="{ aspectRatio: String(cardFormatRatio(format)) }"
        loading="lazy"
        draggable="false"
      >
      <CardArt
        v-else
        :theme="theme"
        :format="format.id"
        :index="card.metadata.shortLabel"
        :red="red"
        :glyph="glyph"
        :image="person?.photos[0]?.url ?? null"
        muted
      />

      <!-- Previous format -->
      <div
        v-if="outdated && !busy"
        class="absolute inset-x-[8%] bottom-[6%] rounded-full bg-warning px-2 py-1 text-center text-[11px] font-medium text-inverted shadow"
      >
        Ancien format
      </div>

      <!-- Generating -->
      <div
        v-if="busy"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden bg-neutral-950/45 text-white"
      >
        <div class="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shimmer" />
        <UIcon
          :name="card.status === 'queued' ? 'i-lucide-clock' : 'i-lucide-loader-circle'"
          class="size-6"
          :class="card.status === 'generating' ? 'animate-spin' : ''"
        />
        <span class="text-xs font-medium">{{ status.label }}</span>
      </div>

      <!-- Failed -->
      <div
        v-else-if="card.status === 'failed' && !selectable"
        class="absolute top-[5%] right-[5%] grid size-6 place-items-center rounded-full bg-error text-inverted shadow"
      >
        <UIcon
          name="i-lucide-triangle-alert"
          class="size-4"
        />
      </div>

      <!-- Needs a person -->
      <div
        v-if="!person && !card.finalImageUrl && !busy"
        class="absolute inset-x-[8%] bottom-[16%] rounded-full bg-neutral-950/70 px-2 py-1 text-center text-[11px] font-medium text-white backdrop-blur"
      >
        Sans personne
      </div>

      <!-- Selection check -->
      <!-- Top-right: the index sits top-left on every format. -->
      <div
        v-if="selectable"
        class="absolute top-[5%] right-[5%] grid size-6 place-items-center rounded-full border-2 shadow transition"
        :class="selected ? 'border-primary bg-primary text-inverted' : 'border-white/90 bg-black/25'"
      >
        <UIcon
          v-if="selected"
          name="i-lucide-check"
          class="size-3.5"
        />
      </div>
    </div>

    <div class="mt-2 flex min-w-0 items-center gap-1.5 px-0.5">
      <UAvatar
        v-if="person"
        :src="person.photos[0]?.url"
        :alt="person.label"
        size="3xs"
        class="shrink-0"
      />
      <span
        v-else
        class="size-4 shrink-0 rounded-full border border-dashed border-accented"
      />
      <span class="truncate text-xs font-medium text-default">{{ card.metadata.label }}</span>
      <UIcon
        v-if="card.prompt"
        name="i-lucide-message-square-text"
        class="ml-auto size-3.5 shrink-0 text-dimmed"
        aria-label="Détail personnalisé"
      />
    </div>
  </button>
</template>
