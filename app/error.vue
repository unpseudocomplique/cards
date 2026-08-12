<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps({
  error: {
    type: Object as PropType<NuxtError>,
    required: true
  }
})

const isNotFound = computed(() => props.error.statusCode === 404)

useHead({
  htmlAttrs: {
    lang: 'fr'
  }
})

useSeoMeta({
  title: isNotFound.value ? 'Page introuvable' : 'Erreur',
  description: isNotFound.value
    ? 'Cette page n’existe pas.'
    : 'Une erreur est survenue.'
})

const handleError = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="salon-wash flex min-h-dvh flex-col">
    <AppHeader :links="navLinks" />
    <main class="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 pt-[calc(var(--ui-header-height)+2rem)] pb-16">
      <p class="text-xs tracking-[0.2em] text-primary uppercase">
        {{ error.statusCode }}
      </p>
      <h1 class="mt-3 font-serif text-4xl tracking-tight text-highlighted">
        {{ isNotFound ? 'Cette carte n’est pas dans le jeu' : 'Quelque chose s’est mal passé' }}
      </h1>
      <p class="mt-3 text-pretty text-muted">
        {{ isNotFound
          ? 'La page demandée n’existe pas. Revenez à l’accueil ou ouvrez une table.'
          : (error.statusMessage || 'Réessayez, ou revenez à l’accueil.') }}
      </p>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row">
        <UButton
          icon="i-lucide-house"
          class="justify-center"
          @click="handleError"
        >
          Retour à l’accueil
        </UButton>
        <UButton
          to="/play"
          color="neutral"
          variant="outline"
          icon="i-lucide-spade"
          class="justify-center"
        >
          Jouer au tarot
        </UButton>
      </div>
    </main>
    <AppFooter />
  </div>
</template>
