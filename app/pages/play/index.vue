<script setup lang="ts">
import type { EndMode, PlayerCount } from '~~/shared/tarot'

definePageMeta({
  middleware: 'auth',
})

useSeoMeta({
  title: 'Nouvelle partie de tarot',
})

const toast = useToast()
const isSubmitting = shallowRef(false)

const form = reactive({
  playerCount: 4 as PlayerCount,
  endMode: 'threshold' as EndMode,
  endValue: 1000,
})

const playerCountOptions = [
  { label: '3 joueurs', value: 3 },
  { label: '4 joueurs', value: 4 },
  { label: '5 joueurs', value: 5 },
]

const endModeOptions = [
  { label: 'Seuil de points', value: 'threshold' },
  { label: 'Nombre de donnes', value: 'deals' },
]

async function createGame() {
  isSubmitting.value = true

  try {
    const result = await $fetch<{ code: string }>('/api/game/create', {
      method: 'POST',
      body: {
        playerCount: form.playerCount,
        endMode: form.endMode,
        endValue: form.endValue,
      },
    })

    await navigateTo(`/play/${result.code}`)
  } catch (error) {
    toast.add({
      title: 'Création impossible',
      description: error instanceof Error ? error.message : 'Veuillez réessayer.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UPage>
    <UPageHeader
      title="Jouer au tarot"
      description="Créez une table privée et invitez vos amis avec un code de partie."
      :ui="{
        container: 'gap-4 py-6 sm:py-8',
      }"
    />

    <UPageSection :ui="{ container: 'max-w-3xl pt-0 pb-8' }">
      <form
        class="space-y-6"
        @submit.prevent="createGame"
      >
        <UFormField
          label="Nombre de joueurs"
          required
        >
          <USelect
            v-model="form.playerCount"
            :items="playerCountOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Fin de partie"
          required
        >
          <USelect
            v-model="form.endMode"
            :items="endModeOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="form.endMode === 'threshold' ? 'Seuil de points' : 'Nombre de donnes'"
          required
        >
          <UInput
            v-model.number="form.endValue"
            type="number"
            min="1"
            class="w-full"
            required
          />
        </UFormField>

        <div class="flex justify-stretch sm:justify-end">
          <UButton
            type="submit"
            class="w-full justify-center sm:w-auto"
            icon="i-lucide-spade"
            :loading="isSubmitting"
          >
            Créer la partie
          </UButton>
        </div>
      </form>
    </UPageSection>
  </UPage>
</template>
