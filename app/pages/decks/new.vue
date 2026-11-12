<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { DeckSummary, DeckType } from '~/types/deck'
import type { CardThemeId } from '~~/shared/utils/cardThemes'
import { cardThemeIds, defaultCardThemeId } from '~~/shared/utils/cardThemes'
import { deckTypeOptions } from '~/utils/deckLabels'
import { CARD_FORMATS, defaultCardFormatForDeckType, formatTrimLabel } from '~~/shared/utils/printSpec'
import { visualStylePresets } from '~/utils/stylePresets'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

useSeoMeta({
  title: 'Nouveau deck'
})

const toast = useToast()

const schema = z.object({
  title: z.string().trim().min(3, 'Au moins 3 caractères').max(100, '100 caractères maximum'),
  description: z.string().max(500).optional(),
  type: z.enum(['classic52', 'tarot56', 'tarot78']),
  colorTheme: z.enum(cardThemeIds),
  visualStyle: z.string().trim().min(3, 'Décrivez le style souhaité').max(160, '160 caractères maximum à la création'),
  allowPhotoReuse: z.boolean()
})

type Schema = z.output<typeof schema>

const state = reactive({
  title: '',
  description: '',
  type: 'tarot78' as DeckType,
  colorTheme: defaultCardThemeId as CardThemeId,
  visualStyle: visualStylePresets[0].value as string,
  allowPhotoReuse: true
})

const typeItems = deckTypeOptions.map(option => ({
  value: option.value,
  label: option.label,
  description: option.description,
  cards: option.cards,
  size: formatTrimLabel(CARD_FORMATS[defaultCardFormatForDeckType(option.value)])
}))

const formatId = computed(() => defaultCardFormatForDeckType(state.type))

async function onSubmit(event: FormSubmitEvent<Schema>) {
  try {
    const deck = await $fetch<DeckSummary>('/api/decks', {
      method: 'POST',
      body: event.data
    })
    await refreshNuxtData('decks')
    toast.add({ title: 'Deck créé', description: 'Ajoutez maintenant les personnes qui figureront sur les cartes.', color: 'success', icon: 'i-lucide-check' })
    await navigateTo(`/decks/${deck.id}/personnes`)
  } catch (error) {
    toast.add({
      title: 'Création impossible',
      description: getApiErrorMessage(error, 'Vérifiez les informations.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  }
}
</script>

<template>
  <UDashboardPanel id="new-deck">
    <template #header>
      <UDashboardNavbar title="Nouveau deck">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="mx-auto w-full max-w-3xl"
        loading-auto
        @submit="onSubmit"
      >
        <div class="mb-8">
          <h1 class="font-display text-4xl text-highlighted">
            Un nouveau jeu
          </h1>
          <p class="mt-2 text-muted">
            Ces réglages restent modifiables plus tard, sauf le format.
          </p>
        </div>

        <div class="divide-y divide-default">
          <section class="grid gap-4 pb-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <div>
              <h2 class="font-medium text-highlighted">
                L’essentiel
              </h2>
              <p class="mt-1 text-sm text-muted">
                Pour le retrouver dans votre bibliothèque.
              </p>
            </div>
            <div class="space-y-4">
              <UFormField
                name="title"
                label="Nom"
                required
              >
                <UInput
                  v-model="state.title"
                  placeholder="Mariage de Léa et Hugo, famille Martin…"
                  size="lg"
                  autofocus
                  class="w-full"
                />
              </UFormField>
              <UFormField
                name="description"
                label="Description"
                hint="Optionnel"
              >
                <UTextarea
                  v-model="state.description"
                  :rows="2"
                  autoresize
                  placeholder="Quelques mots pour vous en souvenir."
                  class="w-full"
                />
              </UFormField>
            </div>
          </section>

          <section class="grid gap-4 py-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <div>
              <h2 class="font-medium text-highlighted">
                Format
              </h2>
              <p class="mt-1 text-sm text-muted">
                Seul le tarot complet se joue en ligne.
              </p>
            </div>
            <UFormField name="type">
              <URadioGroup
                v-model="state.type"
                :items="typeItems"
                variant="card"
                indicator="end"
                :ui="{ fieldset: 'gap-2', item: 'items-start' }"
              >
                <template #label="{ item }">
                  <span class="flex items-center gap-2">
                    {{ item.label }}
                    <UBadge
                      :label="`${item.cards} cartes`"
                      color="neutral"
                      variant="subtle"
                      size="sm"
                    />
                    <UBadge
                      :label="item.size"
                      color="neutral"
                      variant="outline"
                      size="sm"
                    />
                  </span>
                </template>
              </URadioGroup>
            </UFormField>
          </section>

          <section class="grid gap-4 py-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <div>
              <h2 class="font-medium text-highlighted">
                Ambiance
              </h2>
              <p class="mt-1 text-sm text-muted">
                La palette s’applique aux illustrations, au cadre, aux index et au dos.
              </p>
            </div>
            <div class="space-y-6">
              <UFormField
                name="colorTheme"
                label="Thème de couleurs"
              >
                <DeckThemePicker
                  v-model="state.colorTheme"
                  :format="formatId"
                />
              </UFormField>

              <UFormField
                name="visualStyle"
                label="Style des illustrations"
                help="En langage courant : technique, époque, ambiance…"
              >
                <div class="mb-2 flex flex-wrap gap-1.5">
                  <UButton
                    v-for="preset in visualStylePresets"
                    :key="preset.label"
                    :label="preset.label"
                    size="xs"
                    :color="state.visualStyle === preset.value ? 'primary' : 'neutral'"
                    :variant="state.visualStyle === preset.value ? 'soft' : 'outline'"
                    class="rounded-full"
                    @click="state.visualStyle = preset.value"
                  />
                </div>
                <UTextarea
                  v-model="state.visualStyle"
                  :rows="3"
                  autoresize
                  class="w-full"
                />
              </UFormField>
            </div>
          </section>

          <section class="grid gap-4 py-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <div>
              <h2 class="font-medium text-highlighted">
                Distribution
              </h2>
            </div>
            <UFormField name="allowPhotoReuse">
              <USwitch
                v-model="state.allowPhotoReuse"
                label="Une même personne peut apparaître sur plusieurs cartes"
                description="Utile si vous avez moins de personnes que de cartes à illustrer."
              />
            </UFormField>
          </section>
        </div>

        <!-- Negative bottom offsets cancel the panel body padding, see the deck cards page. -->
        <div class="sticky -bottom-4 -mx-4 mt-2 flex justify-end gap-2 border-t border-default bg-default/80 px-4 py-4 backdrop-blur sm:-bottom-6 sm:-mx-6 sm:px-6 lg:-bottom-8 lg:-mx-8 lg:px-8">
          <UButton
            to="/dashboard"
            label="Annuler"
            color="neutral"
            variant="ghost"
          />
          <UButton
            type="submit"
            label="Créer le deck"
            trailing-icon="i-lucide-arrow-right"
          />
        </div>
      </UForm>
    </template>
  </UDashboardPanel>
</template>
