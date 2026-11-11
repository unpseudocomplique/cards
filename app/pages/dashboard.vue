<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

useSeoMeta({
  title: 'Mes decks'
})

const { data: decks, status, refresh } = await useDecks()
const query = shallowRef('')

const filtered = computed(() => {
  const term = query.value.trim().toLowerCase()
  if (!term) {
    return decks.value
  }
  return decks.value.filter(deck =>
    deck.title.toLowerCase().includes(term)
    || deck.description?.toLowerCase().includes(term)
  )
})
</script>

<template>
  <UDashboardPanel id="library">
    <template #header>
      <UDashboardNavbar title="Mes decks">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UInput
            v-if="decks.length > 3"
            v-model="query"
            icon="i-lucide-search"
            placeholder="Rechercher…"
            class="hidden w-56 sm:block"
          />
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            square
            aria-label="Rafraîchir"
            :loading="status === 'pending'"
            @click="refresh()"
          />
          <UButton
            to="/decks/new"
            icon="i-lucide-plus"
            label="Nouveau deck"
            class="hidden sm:inline-flex"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="status === 'pending' && !decks.length"
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <USkeleton
          v-for="index in 3"
          :key="index"
          class="h-72 rounded-xl"
        />
      </div>

      <UEmpty
        v-else-if="!decks.length"
        icon="i-lucide-layers"
        title="Votre premier jeu vous attend"
        description="Créez un deck, ajoutez des photos de vos proches et donnez-leur un rôle : Rois, Dames, atouts…"
        :actions="[{ label: 'Créer un deck', icon: 'i-lucide-plus', to: '/decks/new' }]"
        size="lg"
        class="mx-auto mt-10 max-w-lg"
      />

      <template v-else>
        <UEmpty
          v-if="!filtered.length"
          icon="i-lucide-search-x"
          title="Aucun deck ne correspond"
          variant="naked"
          :actions="[{ label: 'Effacer la recherche', color: 'neutral', variant: 'subtle', onClick: () => { query = '' } }]"
        />
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <DeckLibraryCard
            v-for="deck in filtered"
            :key="deck.id"
            :deck="deck"
          />
          <NuxtLink
            v-if="!query"
            to="/decks/new"
            class="flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-accented text-muted transition hover:border-primary hover:bg-primary/5 hover:text-primary"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-6"
            />
            <span class="text-sm font-medium">Nouveau deck</span>
          </NuxtLink>
        </div>
      </template>
    </template>
  </UDashboardPanel>
</template>
