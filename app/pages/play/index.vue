<script setup lang="ts">
import type { EndMode, PlayerCount } from '~~/shared/tarot'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

useSeoMeta({
  title: 'Jouer'
})

const route = useRoute()
const toast = useToast()
const { data: decks, status } = await useDecks()

const tarotDecks = computed(() => decks.value.filter(deck => deck.type === 'tarot78'))

const form = reactive({
  deckId: typeof route.query.deck === 'string' ? route.query.deck : '',
  playerCount: 4 as PlayerCount,
  endMode: 'threshold' as EndMode,
  endValue: 1000
})

watch(tarotDecks, (list) => {
  if (!list.some(deck => deck.id === form.deckId)) {
    form.deckId = list[0]?.id ?? ''
  }
}, { immediate: true })

watch(() => form.endMode, (mode) => {
  form.endValue = mode === 'threshold' ? 1000 : 5
})

const playerItems = [
  { label: '3 joueurs', value: 3, description: '24 cartes chacun' },
  { label: '4 joueurs', value: 4, description: 'La partie classique' },
  { label: '5 joueurs', value: 5, description: 'Avec appel au roi' }
]

const endItems = [
  { label: 'Au score', value: 'threshold', description: 'Premier à atteindre le seuil' },
  { label: 'Au nombre de donnes', value: 'deals', description: 'Partie de durée fixe' }
]

const creating = shallowRef(false)

async function createTable() {
  if (!form.deckId) {
    return
  }
  creating.value = true
  try {
    const result = await $fetch<{ code: string }>('/api/game/create', {
      method: 'POST',
      body: { ...form }
    })
    await navigateTo(`/play/${result.code}`)
  } catch (err) {
    toast.add({ title: 'Création impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    creating.value = false
  }
}

/* Join */
const joinCode = shallowRef('')
const normalizedCode = computed(() => joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))

function joinTable() {
  if (normalizedCode.value.length >= 6) {
    return navigateTo(`/play/${normalizedCode.value}`)
  }
}
</script>

<template>
  <UDashboardPanel id="play">
    <template #header>
      <UDashboardNavbar title="Jouer">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <h1 class="font-display text-4xl text-highlighted">
            Ouvrir une table
          </h1>
          <p class="mt-2 mb-8 text-muted">
            Vous êtes l’hôte : partagez le lien, ou complétez la table avec des bots.
          </p>

          <div
            v-if="status === 'pending' && !decks.length"
            class="grid gap-3 sm:grid-cols-2"
          >
            <USkeleton
              v-for="index in 2"
              :key="index"
              class="h-40 rounded-xl"
            />
          </div>

          <UEmpty
            v-else-if="!tarotDecks.length"
            icon="i-lucide-layers"
            title="Il vous faut un tarot complet"
            description="Seuls les decks « Tarot complet » (78 cartes) se jouent en ligne. Les cartes encore vides s’afficheront sous forme classique."
            :actions="[{ label: 'Créer un tarot', icon: 'i-lucide-plus', to: '/decks/new' }]"
            variant="subtle"
          />

          <form
            v-else
            class="space-y-8"
            @submit.prevent="createTable"
          >
            <fieldset>
              <legend class="mb-3 text-sm font-medium text-highlighted">
                Jeu de cartes
              </legend>
              <div
                class="grid grid-cols-2 gap-3 sm:grid-cols-3"
                role="radiogroup"
              >
                <button
                  v-for="deck in tarotDecks"
                  :key="deck.id"
                  type="button"
                  role="radio"
                  :aria-checked="form.deckId === deck.id"
                  class="group overflow-hidden rounded-xl text-left ring transition outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  :class="form.deckId === deck.id ? 'ring-2 ring-primary' : 'ring-default hover:ring-accented'"
                  @click="form.deckId = deck.id"
                >
                  <DeckCover
                    :urls="deck.coverUrls"
                    :theme-id="deck.settings?.colorTheme"
                    :format-id="deck.settings?.cardFormat"
                    class="h-24 bg-elevated/50"
                  />
                  <div class="flex items-center gap-2 p-2.5">
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-highlighted">
                        {{ deck.title }}
                      </p>
                      <p class="text-xs text-muted tabular-nums">
                        {{ deck.readyCardCount }}/{{ deck.cardCount }} illustrées
                      </p>
                    </div>
                    <UIcon
                      v-if="form.deckId === deck.id"
                      name="i-lucide-circle-check"
                      class="size-5 shrink-0 text-primary"
                    />
                  </div>
                </button>
              </div>
            </fieldset>

            <URadioGroup
              v-model="form.playerCount"
              legend="Nombre de joueurs"
              :items="playerItems"
              variant="table"
              orientation="horizontal"
              indicator="hidden"
              :ui="{ legend: 'mb-3 text-sm font-medium text-highlighted', item: 'flex-1' }"
            />

            <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-end">
              <URadioGroup
                v-model="form.endMode"
                legend="Fin de partie"
                :items="endItems"
                variant="table"
                orientation="horizontal"
                indicator="hidden"
                :ui="{ legend: 'mb-3 text-sm font-medium text-highlighted', item: 'flex-1' }"
              />
              <UFormField :label="form.endMode === 'threshold' ? 'Points' : 'Donnes'">
                <UInputNumber
                  v-model="form.endValue"
                  :min="1"
                  :step="form.endMode === 'threshold' ? 100 : 1"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UButton
              type="submit"
              label="Ouvrir la table"
              icon="i-lucide-spade"
              size="lg"
              :loading="creating"
              :disabled="!form.deckId"
            />
          </form>
        </section>

        <aside class="space-y-4">
          <UCard variant="subtle">
            <h2 class="font-semibold text-highlighted">
              Rejoindre une table
            </h2>
            <p class="mt-1 mb-4 text-sm text-muted">
              Entrez le code que l’hôte vous a envoyé.
            </p>
            <form
              class="flex gap-2"
              @submit.prevent="joinTable"
            >
              <UInput
                v-model="joinCode"
                placeholder="AB12CD"
                :maxlength="10"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                class="flex-1"
                :ui="{ base: 'font-mono uppercase tracking-[0.2em]' }"
                aria-label="Code de la table"
              />
              <UButton
                type="submit"
                icon="i-lucide-arrow-right"
                square
                :disabled="normalizedCode.length < 6"
                aria-label="Rejoindre"
              />
            </form>
          </UCard>

          <div class="rounded-xl p-4 text-sm text-muted ring ring-default">
            <p class="mb-2 font-medium text-highlighted">
              Bon à savoir
            </p>
            <ul class="space-y-2">
              <li class="flex gap-2">
                <UIcon
                  name="i-lucide-smartphone"
                  class="mt-0.5 size-4 shrink-0"
                />
                Sur téléphone, la table se joue en paysage.
              </li>
              <li class="flex gap-2">
                <UIcon
                  name="i-lucide-bot"
                  class="mt-0.5 size-4 shrink-0"
                />
                L’hôte peut ajouter des bots pour compléter la table.
              </li>
              <li class="flex gap-2">
                <UIcon
                  name="i-lucide-image"
                  class="mt-0.5 size-4 shrink-0"
                />
                Les cartes pas encore illustrées s’affichent en version classique.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </template>
  </UDashboardPanel>
</template>
