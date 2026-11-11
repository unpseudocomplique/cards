<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { deckTypeLabels } from '~/utils/deckLabels'

const route = useRoute()
const open = shallowRef(false)
const { data: decks } = useDecks()

const mainLinks = computed<NavigationMenuItem[]>(() => [{
  label: 'Mes decks',
  icon: 'i-lucide-library',
  to: '/dashboard',
  active: route.path === '/dashboard',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Jouer',
  icon: 'i-lucide-spade',
  to: '/play',
  active: route.path === '/play',
  onSelect: () => {
    open.value = false
  }
}])

const deckLinks = computed<NavigationMenuItem[]>(() => (decks.value ?? []).slice(0, 8).map(deck => ({
  label: deck.title,
  to: `/decks/${deck.id}`,
  active: route.path.startsWith(`/decks/${deck.id}`),
  badge: deckTypeLabels[deck.type]?.replace(/\D+/g, '') || undefined,
  onSelect: () => {
    open.value = false
  }
})))
</script>

<template>
  <UDashboardGroup
    unit="rem"
    storage="local"
    storage-key="cards-dashboard"
  >
    <UDashboardSidebar
      id="app-sidebar"
      v-model:open="open"
      collapsible
      resizable
      :default-size="15"
      :min-size="13"
      :max-size="20"
      class="bg-elevated/40"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <AppLogo
          :collapsed="collapsed"
          to="/dashboard"
          class="px-1"
        />
      </template>

      <template #default="{ collapsed }">
        <UButton
          to="/decks/new"
          icon="i-lucide-plus"
          :label="collapsed ? undefined : 'Nouveau deck'"
          :square="collapsed"
          block
          class="mb-1"
          @click="open = false"
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="mainLinks"
          orientation="vertical"
          tooltip
        />

        <template v-if="deckLinks.length && !collapsed">
          <p class="mt-4 px-2.5 text-xs font-medium text-dimmed">
            Decks récents
          </p>
          <UNavigationMenu
            :items="deckLinks"
            orientation="vertical"
            :ui="{ linkLabel: 'truncate', linkTrailingBadge: 'font-mono' }"
          />
        </template>
      </template>

      <template #footer="{ collapsed }">
        <AppUserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
