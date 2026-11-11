<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import { deckStatusMeta, deckTypeLabels } from '~/utils/deckLabels'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const route = useRoute()
const toast = useToast()
const deckId = computed(() => String(route.params.id))
const workspace = provideDeckWorkspace(deckId)
const { deck, stats, persons, job, error, status, refresh, stopGeneration } = workspace

await workspace.request

useSeoMeta({
  title: () => deck.value?.title ?? 'Deck'
})

const base = computed(() => `/decks/${deckId.value}`)

const tabs = computed<NavigationMenuItem[]>(() => [{
  label: 'Cartes',
  icon: 'i-lucide-gallery-vertical-end',
  to: base.value,
  exact: true,
  badge: stats.value.total ? `${stats.value.ready}/${stats.value.total}` : undefined
}, {
  label: 'Personnes',
  icon: 'i-lucide-users-round',
  to: `${base.value}/personnes`,
  badge: persons.value.length || undefined
}, {
  label: 'Style',
  icon: 'i-lucide-palette',
  to: `${base.value}/style`
}, {
  label: 'Dos & impression',
  icon: 'i-lucide-printer',
  to: `${base.value}/impression`
}])

const percent = computed(() => stats.value.total ? Math.round((stats.value.ready / stats.value.total) * 100) : 0)

const deleteOpen = shallowRef(false)
const deleting = shallowRef(false)

const menu = computed<DropdownMenuItem[][]>(() => [[
  ...(deck.value?.type === 'tarot78'
    ? [{ label: 'Jouer avec ce deck', icon: 'i-lucide-spade', to: { path: '/play', query: { deck: deckId.value } } }]
    : []),
  { label: 'Rafraîchir', icon: 'i-lucide-refresh-cw', onSelect: () => refresh() }
], [
  { label: 'Supprimer le deck', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => { deleteOpen.value = true } }
]])

async function deleteDeck() {
  deleting.value = true
  try {
    await $fetch(`/api/decks/${deckId.value}`, { method: 'DELETE' })
    await refreshNuxtData('decks')
    toast.add({ title: 'Deck supprimé', color: 'success', icon: 'i-lucide-check' })
    await navigateTo('/dashboard')
  } catch (err) {
    toast.add({ title: 'Suppression impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    deleting.value = false
    deleteOpen.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="deck">
    <template #header>
      <UDashboardNavbar :ui="{ title: 'min-w-0' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #title>
          <div class="flex min-w-0 items-center gap-2">
            <ULink
              to="/dashboard"
              class="hidden shrink-0 text-muted hover:text-default sm:inline"
            >
              Mes decks
            </ULink>
            <UIcon
              name="i-lucide-chevron-right"
              class="hidden size-4 shrink-0 text-dimmed sm:block"
            />
            <span class="truncate">{{ deck?.title ?? 'Deck' }}</span>
            <UBadge
              v-if="deck"
              :label="deckTypeLabels[deck.type]"
              color="neutral"
              variant="subtle"
              size="sm"
              class="hidden shrink-0 md:inline-flex"
            />
          </div>
        </template>

        <template #right>
          <div
            v-if="job"
            class="flex items-center gap-2 rounded-full bg-primary/10 py-1 pr-1 pl-3 text-sm text-primary"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 animate-spin"
            />
            <span class="tabular-nums">{{ job.completed }}/{{ job.total }}</span>
            <UButton
              :label="job.stopping ? 'Arrêt…' : 'Arrêter'"
              size="xs"
              color="primary"
              variant="soft"
              class="rounded-full"
              :disabled="job.stopping"
              @click="stopGeneration"
            />
          </div>
          <div
            v-else-if="deck"
            class="hidden items-center gap-2 sm:flex"
          >
            <UProgress
              :model-value="percent"
              size="xs"
              class="w-24"
              :color="percent === 100 ? 'success' : 'primary'"
            />
            <UBadge
              :label="deckStatusMeta[deck.status]?.label"
              :color="deckStatusMeta[deck.status]?.color"
              variant="subtle"
              size="sm"
            />
          </div>
          <UDropdownMenu
            :items="menu"
            :content="{ align: 'end' }"
          >
            <UButton
              icon="i-lucide-ellipsis"
              color="neutral"
              variant="ghost"
              square
              aria-label="Actions du deck"
            />
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar
        v-if="deck"
        class="overflow-x-auto"
      >
        <UNavigationMenu
          :items="tabs"
          highlight
          class="-mx-1 flex-1"
          :ui="{ linkTrailingBadge: 'font-mono tabular-nums' }"
        />
      </UDashboardToolbar>
    </template>

    <template #body>
      <UEmpty
        v-if="error || (!deck && status !== 'pending')"
        icon="i-lucide-file-question"
        title="Deck introuvable"
        description="Il a peut-être été supprimé, ou il appartient à un autre compte."
        :actions="[{ label: 'Retour à mes decks', to: '/dashboard' }]"
        class="mx-auto mt-10 max-w-md"
      />
      <NuxtPage v-else-if="deck" />

      <UModal
        v-model:open="deleteOpen"
        title="Supprimer ce deck ?"
        :description="`« ${deck?.title} » et ses cartes générées ne seront plus accessibles.`"
        :ui="{ footer: 'justify-end' }"
      >
        <template #footer="{ close }">
          <UButton
            label="Annuler"
            color="neutral"
            variant="ghost"
            @click="close"
          />
          <UButton
            label="Supprimer"
            color="error"
            icon="i-lucide-trash-2"
            :loading="deleting"
            @click="deleteDeck"
          />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
