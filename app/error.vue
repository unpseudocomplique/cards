<script setup lang="ts">
import type { NuxtError } from '#app'
import { fr } from '@nuxt/ui/locale'

const props = defineProps<{
  error: NuxtError
}>()

const notFound = computed(() => props.error.statusCode === 404)

useHead({
  htmlAttrs: { lang: 'fr' }
})

useSeoMeta({
  title: notFound.value ? 'Page introuvable' : 'Erreur'
})

function home() {
  return clearError({ redirect: '/' })
}
</script>

<template>
  <UApp :locale="fr">
    <div class="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <AppLogo class="mb-12" />
      <div class="w-28">
        <CardArt
          :glyph="notFound ? '?' : '!'"
          :index="String(error.statusCode)"
          class="-rotate-6 shadow-xl"
        />
      </div>
      <h1 class="mt-10 font-display text-4xl text-highlighted sm:text-5xl">
        {{ notFound ? 'Cette carte n’est pas dans le jeu' : 'La donne a mal tourné' }}
      </h1>
      <p class="mt-3 max-w-md text-pretty text-muted">
        {{ notFound
          ? 'La page demandée n’existe pas ou plus.'
          : (error.statusMessage || error.message || 'Une erreur inattendue est survenue. Réessayez dans un instant.') }}
      </p>
      <div class="mt-8 flex flex-col gap-2 sm:flex-row">
        <UButton
          label="Retour à l’accueil"
          icon="i-lucide-house"
          @click="home"
        />
        <UButton
          label="Mes decks"
          color="neutral"
          variant="subtle"
          @click="clearError({ redirect: '/dashboard' })"
        />
      </div>
    </div>
  </UApp>
</template>
