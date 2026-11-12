<script setup lang="ts">
import type { DropdownMenuItem, TabsItem } from '@nuxt/ui'
import type { CardRolePromptKey, CardSuitPromptKey, DeckCard } from '~/types/deck'
import { cardRole, cardSuit, faceRoles, isGeneratable, roleMeta, suitMeta } from '~/utils/deckLabels'

type StatusFilter = CardStatusFilter

const toast = useToast()
const { deckId, cards, theme, format, isOutdated, personFor, persons, stats, job, generateCards, assignCards } = useDeckWorkspace()

const filters = useDeckCardFilters(deckId)

const statusMatchers: Record<StatusFilter, (card: DeckCard) => boolean> = {
  all: () => true,
  todo: card => card.status !== 'ready',
  ready: card => card.status === 'ready',
  failed: card => card.status === 'failed',
  unassigned: card => !card.sourcePersonId,
  outdated: card => isOutdated(card)
}

const statusTabs = computed<TabsItem[]>(() => {
  const count = (key: StatusFilter) => cards.value.filter(statusMatchers[key]).length
  return [
    { label: 'Toutes', value: 'all', badge: count('all') },
    { label: 'À faire', value: 'todo', badge: count('todo') },
    { label: 'Prêtes', value: 'ready', badge: count('ready') },
    ...(stats.value.failed ? [{ label: 'Échecs', value: 'failed', badge: { label: String(stats.value.failed), color: 'error' as const } }] : []),
    ...(stats.value.unassigned ? [{ label: 'Sans personne', value: 'unassigned', badge: count('unassigned') }] : []),
    ...(stats.value.outdated ? [{ label: 'Ancien format', value: 'outdated', badge: { label: String(stats.value.outdated), color: 'warning' as const } }] : [])
  ]
})

const suitItems = computed(() => {
  const present = new Set(cards.value.map(cardSuit).filter(Boolean))
  return [
    { label: 'Toutes les couleurs', value: 'all' },
    ...(Object.keys(suitMeta) as CardSuitPromptKey[])
      .filter(suit => present.has(suit))
      .map(suit => ({ label: `${suitMeta[suit].symbol}  ${suitMeta[suit].label}`, value: suit }))
  ]
})

const roleItems = computed(() => {
  const present = new Set(cards.value.map(cardRole))
  return [
    { label: 'Tous les types', value: 'all' },
    { label: 'Figures', value: 'face' },
    ...(Object.keys(roleMeta) as CardRolePromptKey[])
      .filter(role => present.has(role))
      .sort((a, b) => roleMeta[a].order - roleMeta[b].order)
      .map(role => ({ label: roleMeta[role].plural, value: role }))
  ]
})

const visibleCards = computed(() => {
  const { status, suit, role, query } = filters.value
  const term = query.trim().toLowerCase()

  return cards.value.filter((card) => {
    if (!statusMatchers[status](card)) {
      return false
    }
    if (suit !== 'all' && cardSuit(card) !== suit) {
      return false
    }
    if (role === 'face' && !faceRoles.includes(cardRole(card))) {
      return false
    }
    if (role !== 'all' && role !== 'face' && cardRole(card) !== role) {
      return false
    }
    if (term) {
      const haystack = `${card.metadata.label} ${card.metadata.shortLabel} ${personFor(card)?.label ?? ''}`.toLowerCase()
      return haystack.includes(term)
    }
    return true
  })
})

const visibleIds = computed(() => visibleCards.value.map(card => card.id))
const filtersActive = computed(() => filters.value.status !== 'all' || filters.value.suit !== 'all' || filters.value.role !== 'all' || Boolean(filters.value.query))

function resetFilters() {
  filters.value = emptyCardFilters()
}

/* Detail */
const openCardId = shallowRef<string | null>(null)

/* Selection */
const selecting = shallowRef(false)
const selected = shallowRef(new Set<string>())

function toggle(cardId: string) {
  const next = new Set(selected.value)
  if (next.has(cardId)) {
    next.delete(cardId)
  } else {
    next.add(cardId)
  }
  selected.value = next
}

function selectVisible() {
  selected.value = new Set([...selected.value, ...visibleIds.value])
}

function stopSelecting() {
  selecting.value = false
  selected.value = new Set()
}

const selectedCards = computed(() => cards.value.filter(card => selected.value.has(card.id)))
const assigningSelection = shallowRef(false)

const assignMenu = computed<DropdownMenuItem[][]>(() => [
  persons.value.map(person => ({
    label: person.label,
    avatar: { src: person.photos[0]?.url, alt: person.label },
    onSelect: () => assignSelection(person.id)
  })),
  [{ label: 'Retirer la personne', icon: 'i-lucide-user-round-x', onSelect: () => assignSelection(null) }]
])

async function assignSelection(personId: string | null) {
  assigningSelection.value = true
  const count = await assignCards(selectedCards.value, personId)
  assigningSelection.value = false
  toast.add({
    title: personId ? 'Personne attribuée' : 'Personne retirée',
    description: `${count} carte${count > 1 ? 's' : ''} mise${count > 1 ? 's' : ''} à jour.`,
    color: 'success',
    icon: 'i-lucide-check'
  })
}

function generateSelection() {
  const targets = selectedCards.value
  stopSelecting()
  void generateCards(targets)
}

function generatePending() {
  void generateCards(cards.value.filter(isGeneratable))
}

// Only bound while selecting: a matched shortcut prevents the key's default,
// which would stop Escape from closing the card slideover.
defineShortcuts(computed(() => selecting.value && !openCardId.value
  ? { escape: stopSelecting }
  : {}))
</script>

<template>
  <div class="flex flex-col gap-6">
    <DeckSetupGuide
      v-if="stats.ready < stats.total"
      @generate="generatePending"
    />

    <!-- Toolbar -->
    <!--
      Sticky offsets cancel the panel body padding (p-4 / sm:p-6 / lg:p-8):
      sticky elements stick to the padding edge, not to the visible top.
    -->
    <div class="sticky -top-4 z-10 -mx-4 flex flex-col gap-3 border-b border-default bg-default/85 px-4 py-3 backdrop-blur sm:-top-6 sm:-mx-6 sm:px-6 lg:-top-8 lg:-mx-8 lg:px-8">
      <div class="-mx-1 overflow-x-auto px-1">
        <UTabs
          v-model="filters.status"
          :items="statusTabs"
          :content="false"
          variant="link"
          size="sm"
          class="w-max min-w-full"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="filters.query"
          icon="i-lucide-search"
          placeholder="Carte ou personne…"
          size="sm"
          class="w-full sm:w-52"
          :ui="{ trailing: 'pe-1' }"
        >
          <template
            v-if="filters.query"
            #trailing
          >
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="link"
              aria-label="Effacer"
              @click="filters.query = ''"
            />
          </template>
        </UInput>
        <USelect
          v-model="filters.suit"
          :items="suitItems"
          size="sm"
          class="w-[calc(50%-0.25rem)] sm:w-44"
        />
        <USelect
          v-model="filters.role"
          :items="roleItems"
          size="sm"
          class="w-[calc(50%-0.25rem)] sm:w-40"
        />
        <UButton
          v-if="filtersActive"
          label="Réinitialiser"
          size="sm"
          color="neutral"
          variant="link"
          @click="resetFilters"
        />

        <div class="ml-auto flex items-center gap-2">
          <UButton
            :label="selecting ? 'Terminer' : 'Sélectionner'"
            :icon="selecting ? 'i-lucide-x' : 'i-lucide-square-check-big'"
            size="sm"
            color="neutral"
            :variant="selecting ? 'solid' : 'outline'"
            @click="selecting ? stopSelecting() : (selecting = true)"
          />
          <UButton
            v-if="!selecting"
            :label="stats.generatable ? `Générer ${stats.generatable}` : 'Tout est généré'"
            icon="i-lucide-sparkles"
            size="sm"
            :disabled="!stats.generatable || Boolean(job)"
            @click="generatePending"
          />
        </div>
      </div>
    </div>

    <!-- Grid -->
    <div
      v-if="visibleCards.length"
      class="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]"
    >
      <DeckCardTile
        v-for="card in visibleCards"
        :key="card.id"
        :card="card"
        :person="personFor(card)"
        :theme="theme"
        :format="format"
        :outdated="isOutdated(card)"
        :selectable="selecting"
        :selected="selected.has(card.id)"
        @open="openCardId = card.id"
        @toggle="toggle(card.id)"
      />
    </div>

    <UEmpty
      v-else
      icon="i-lucide-filter-x"
      title="Aucune carte ici"
      description="Aucune carte ne correspond à ces filtres."
      variant="naked"
      :actions="[{ label: 'Voir toutes les cartes', color: 'neutral', variant: 'subtle', onClick: resetFilters }]"
    />

    <!-- Selection bar -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-4 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div
        v-if="selecting"
        class="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl bg-elevated/95 p-2 pl-4 shadow-2xl ring ring-accented backdrop-blur"
      >
        <span class="text-sm font-medium whitespace-nowrap text-highlighted tabular-nums">
          {{ selected.size }} sélectionnée{{ selected.size > 1 ? 's' : '' }}
        </span>
        <UButton
          label="Tout"
          size="sm"
          color="neutral"
          variant="ghost"
          @click="selectVisible"
        />
        <USeparator
          orientation="vertical"
          class="h-5"
        />
        <UDropdownMenu
          :items="assignMenu"
          :content="{ side: 'top' }"
          :disabled="!selected.size || !persons.length"
        >
          <UButton
            label="Attribuer à…"
            icon="i-lucide-user-round-plus"
            size="sm"
            color="neutral"
            variant="outline"
            class="whitespace-nowrap"
            :loading="assigningSelection"
            :disabled="!selected.size || !persons.length"
          />
        </UDropdownMenu>
        <UButton
          label="Générer"
          icon="i-lucide-sparkles"
          size="sm"
          :disabled="!selected.size || Boolean(job)"
          @click="generateSelection"
        />
      </div>
    </Transition>

    <DeckCardSlideover
      v-model:card-id="openCardId"
      :ids="visibleIds"
    />
  </div>
</template>
