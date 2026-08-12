<script setup lang="ts">
import type { DeckSummary, DeckType } from '~/types/deck'

definePageMeta({
  middleware: 'auth'
})

useSeoMeta({
  title: 'Nouveau deck'
})

const toast = useToast()
const isSubmitting = shallowRef(false)
const form = reactive({
  title: '',
  description: '',
  type: 'classic52' as DeckType,
  allowPhotoReuse: true,
  visualStyle: 'illustration royale contemporaine, couleurs riches, rendu premium'
})

async function createDeck() {
  isSubmitting.value = true

  try {
    const deck = await $fetch<DeckSummary>('/api/decks', {
      method: 'POST',
      body: form
    })

    toast.add({
      title: 'Deck créé',
      description: deck.title,
      color: 'success',
      icon: 'i-lucide-check'
    })
    await navigateTo(`/decks/${deck.id}`)
  } catch (error) {
    toast.add({
      title: 'Création impossible',
      description: error instanceof Error ? error.message : 'Veuillez vérifier les informations.',
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <header class="mb-8">
      <p class="text-xs tracking-[0.2em] text-primary uppercase">
        Atelier
      </p>
      <h1 class="mt-2 font-serif text-3xl tracking-tight text-highlighted sm:text-4xl">
        Nouveau deck
      </h1>
      <p class="mt-2 max-w-[46ch] text-pretty text-muted">
        Choisissez le format du jeu, puis importez les photos et générez les cartes.
      </p>
    </header>

    <form
      class="max-w-xl space-y-6"
      @submit.prevent="createDeck"
    >
        <UFormField
          label="Nom du deck"
          required
        >
          <UInput
            v-model="form.title"
            class="w-full"
            placeholder="Mariage, famille, équipe..."
            required
          />
        </UFormField>

        <UFormField label="Description">
          <UTextarea
            v-model="form.description"
            class="w-full"
            placeholder="Quelques mots pour reconnaître ce jeu."
            :rows="3"
          />
        </UFormField>

        <UFormField label="Format">
          <DeckTypePicker v-model="form.type" />
        </UFormField>

        <UFormField label="Style visuel">
          <UTextarea
            v-model="form.visualStyle"
            class="w-full"
            :rows="3"
          />
        </UFormField>

        <UCheckbox
          v-model="form.allowPhotoReuse"
          label="Autoriser la réutilisation d'une même photo sur plusieurs cartes"
          description="Utile si vous n'avez pas assez de photos pour toutes les cartes."
          :ui="{
            root: 'items-start',
            label: 'text-pretty',
            description: 'text-pretty'
          }"
        />

        <div class="flex justify-stretch sm:justify-end">
          <UButton
            type="submit"
            class="w-full justify-center sm:w-auto"
            icon="i-lucide-arrow-right"
            :loading="isSubmitting"
          >
            Créer le deck
          </UButton>
        </div>
      </form>
  </div>
</template>
