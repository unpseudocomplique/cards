<script setup lang="ts">
import type { SharedDeck, SharedDeckCard } from '~~/shared/types/sharedDeck'
import type { CardSuitPromptKey } from '~/types/deck'
import { getCardTheme } from '~~/shared/utils/cardThemes'
import { cardFormatRatio, resolveDeckCardFormat } from '~~/shared/utils/printSpec'
import { deckTypeLabels, suitMeta } from '~/utils/deckLabels'

const route = useRoute()
const token = computed(() => String(route.params.token))

const { data: deck, error } = await useFetch<SharedDeck>(() => `/api/share/${token.value}`, {
  key: () => `share-${token.value}`
})

const theme = computed(() => getCardTheme(deck.value?.colorTheme))
const format = computed(() => resolveDeckCardFormat({ cardFormat: deck.value?.cardFormat }))
const ratio = computed(() => String(cardFormatRatio(format.value)))
/* Versions: the deck, then its named variants. */
const variants = computed(() => deck.value?.variants ?? [])
const version = shallowRef('base')
const currentVariant = computed(() => version.value === 'base'
  ? null
  : variants.value.find(variant => String(variant.key) === version.value) ?? null)
const versionItems = computed(() => [
  { label: 'Version originale', value: 'base' },
  ...variants.value.map(variant => ({ label: variant.name, value: String(variant.key) }))
])
const cards = computed(() => currentVariant.value?.cards ?? deck.value?.cards ?? [])
const backImageUrl = computed(() => currentVariant.value ? currentVariant.value.backImageUrl : deck.value?.backImageUrl ?? null)
const changedCount = computed(() => cards.value.filter(card => card.changed).length)

/** Most recognisable faces first, for the cover and link previews. */
const coverRoles = ['king', 'queen', 'knight', 'jack', 'trump', 'excuse']
const coverUrls = computed(() => [...(deck.value?.cards ?? [])]
  .sort((a, b) => rolePriority(a) - rolePriority(b))
  .slice(0, 3)
  .map(card => card.imageUrl))

function rolePriority(card: SharedDeckCard) {
  const index = coverRoles.indexOf(card.role ?? '')
  return index === -1 ? coverRoles.length : index
}

// Chat apps need an absolute URL for the preview image (local uploads are relative).
const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
const ogImage = computed(() => {
  const url = coverUrls.value[1] ?? coverUrls.value[0]
  return url?.startsWith('/') ? `${siteUrl}${url}` : url
})

useSeoMeta({
  title: () => deck.value ? deck.value.title : 'Deck partagé',
  description: () => deck.value ? `Un jeu de cartes créé par ${deck.value.ownerName}.` : undefined,
  ogTitle: () => deck.value?.title,
  ogDescription: () => deck.value ? `Un jeu de cartes créé par ${deck.value.ownerName}.` : undefined,
  ogImage: () => ogImage.value,
  robots: 'noindex, nofollow'
})

/* Suit filter */
const suit = shallowRef<'all' | CardSuitPromptKey>('all')
const suitItems = computed(() => {
  const present = new Set(cards.value.map(card => card.suit).filter(Boolean))
  return [
    { label: 'Toutes', value: 'all' },
    ...(Object.keys(suitMeta) as CardSuitPromptKey[])
      .filter(key => present.has(key))
      .map(key => ({ label: `${suitMeta[key].symbol} ${suitMeta[key].label}`, value: key }))
  ]
})
const visibleCards = computed(() => suit.value === 'all'
  ? cards.value
  : cards.value.filter(card => card.suit === suit.value))

/* Viewer */
const openIndex = shallowRef<number | null>(null)
const showBack = shallowRef(false)
const openCard = computed(() => openIndex.value === null ? null : visibleCards.value[openIndex.value] ?? null)
const viewerOpen = computed({
  get: () => openCard.value !== null,
  set: (value) => {
    if (!value) {
      openIndex.value = null
    }
  }
})

watch(version, () => {
  openIndex.value = null
})

function open(index: number) {
  showBack.value = false
  openIndex.value = index
}

function step(delta: number) {
  if (openIndex.value === null || !visibleCards.value.length) {
    return
  }
  showBack.value = false
  openIndex.value = (openIndex.value + delta + visibleCards.value.length) % visibleCards.value.length
}

defineShortcuts(computed(() => viewerOpen.value
  ? { arrowleft: () => step(-1), arrowright: () => step(1) }
  : {}))

function isRed(card: SharedDeckCard) {
  return Boolean(card.suit && suitMeta[card.suit as CardSuitPromptKey]?.red)
}
</script>

<template>
  <UContainer class="py-10 sm:py-14">
    <UEmpty
      v-if="error || !deck"
      icon="i-lucide-link-2-off"
      title="Lien de partage introuvable"
      description="Ce lien n’existe pas ou a été désactivé par la personne qui l’a partagé."
      :actions="[{ label: 'Découvrir l’atelier', to: '/' }]"
      class="mx-auto mt-10 max-w-md"
    />

    <template v-else>
      <header class="flex flex-col items-center gap-6 text-center">
        <DeckCover
          :urls="coverUrls"
          :theme-id="deck.colorTheme"
          :format-id="deck.cardFormat"
          class="group h-48 w-full max-w-md sm:h-56"
        />
        <div class="flex flex-col items-center gap-2">
          <UBadge
            :label="`${deckTypeLabels[deck.type]} · lecture seule`"
            icon="i-lucide-eye"
            color="neutral"
            variant="subtle"
          />
          <h1 class="font-display text-4xl leading-tight text-highlighted sm:text-5xl">
            {{ deck.title }}
          </h1>
          <p class="text-sm text-muted">
            Un jeu créé par {{ deck.ownerName }} ·
            <span class="tabular-nums">{{ cards.length }}</span>
            <template v-if="cards.length < deck.cardCount">
              cartes prêtes sur <span class="tabular-nums">{{ deck.cardCount }}</span>
            </template>
            <template v-else>
              cartes
            </template>
          </p>
          <p
            v-if="deck.description"
            class="max-w-prose text-sm text-default"
          >
            {{ deck.description }}
          </p>
        </div>
      </header>

      <UEmpty
        v-if="!cards.length"
        icon="i-lucide-hourglass"
        title="Les cartes arrivent"
        description="Aucune carte n’est encore prête dans ce deck. Revenez un peu plus tard."
        variant="naked"
        class="mt-12"
      />

      <template v-else>
        <div
          v-if="variants.length"
          class="mt-10 flex flex-col items-center gap-2"
        >
          <div class="-mx-1 max-w-full overflow-x-auto px-1">
            <UTabs
              v-model="version"
              :items="versionItems"
              :content="false"
              size="sm"
              class="w-max"
            />
          </div>
          <p
            v-if="currentVariant"
            class="text-sm text-muted"
          >
            Variante « {{ currentVariant.name }} » :
            <template v-if="changedCount">
              {{ changedCount }} carte{{ changedCount > 1 ? 's' : '' }} différente{{ changedCount > 1 ? 's' : '' }} de la version originale.
            </template>
            <template v-else>
              mêmes faces que la version originale.
            </template>
          </p>
        </div>

        <div
          v-if="suitItems.length > 2"
          class="mt-10 -mx-1 overflow-x-auto px-1"
        >
          <UTabs
            v-model="suit"
            :items="suitItems"
            :content="false"
            variant="pill"
            size="sm"
            class="mx-auto w-max"
          />
        </div>

        <div class="mt-8 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]">
          <button
            v-for="(card, index) in visibleCards"
            :key="`${version}-${card.key}`"
            type="button"
            class="group block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-(--ui-bg)"
            :aria-label="`Agrandir ${card.label}`"
            @click="open(index)"
          >
            <span class="relative block">
              <img
                :src="card.imageUrl"
                :alt="card.label"
                class="w-full rounded-[6%] object-cover shadow-sm ring-1 ring-black/5 transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg dark:ring-white/5"
                :style="{ aspectRatio: ratio }"
                loading="lazy"
                draggable="false"
              >
              <span
                v-if="card.changed"
                class="absolute top-[5%] right-[5%] rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-inverted shadow"
              >Variante</span>
            </span>
            <span
              class="mt-2 block truncate px-0.5 text-xs font-medium"
              :class="isRed(card) ? 'text-error' : 'text-default'"
            >{{ card.label }}</span>
          </button>
        </div>
      </template>

      <div class="mt-16 flex flex-col items-center gap-3 text-center">
        <p class="text-sm text-muted">
          Envie d’un jeu avec les visages de vos proches ?
        </p>
        <UButton
          to="/auth/register"
          label="Créer mon propre deck"
          trailing-icon="i-lucide-arrow-right"
          variant="soft"
        />
      </div>

      <UModal
        v-model:open="viewerOpen"
        :title="openCard?.label ?? ''"
        :description="`${(openIndex ?? 0) + 1} / ${visibleCards.length}`"
        :ui="{ content: 'sm:max-w-md', body: 'flex flex-col items-center gap-4' }"
      >
        <template #body>
          <div
            v-if="openCard"
            class="w-full max-w-[min(22rem,calc(70dvh*var(--card-ratio)))]"
            :style="{ '--card-ratio': ratio }"
          >
            <img
              :src="showBack && backImageUrl ? backImageUrl : openCard.imageUrl"
              :alt="showBack ? 'Dos de carte' : openCard.label"
              class="w-full rounded-[5%] object-cover shadow-xl shadow-black/30"
              :style="{ aspectRatio: ratio, backgroundColor: theme.colors.paper }"
              draggable="false"
            >
          </div>
          <div class="flex w-full items-center justify-between gap-2">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="ghost"
              aria-label="Carte précédente"
              @click="step(-1)"
            />
            <UButton
              v-if="backImageUrl"
              :label="showBack ? 'Voir la face' : 'Voir le dos'"
              icon="i-lucide-repeat"
              color="neutral"
              variant="subtle"
              size="sm"
              @click="showBack = !showBack"
            />
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="ghost"
              aria-label="Carte suivante"
              @click="step(1)"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UContainer>
</template>
