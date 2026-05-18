<script setup lang="ts">
useSeoMeta({
  title: 'Créer un jeu de cartes personnalisé',
  description: 'Importez des photos, choisissez un jeu classique ou tarot, puis générez des cartes personnalisées prêtes à exporter.'
})
</script>

<template>
  <UPage>
    <UPageHero
      title="Créez un jeu de cartes à partir de vos photos"
      description="Composez un deck classique de 52 cartes ou un tarot complet avec Valets, Cavaliers, Dames, Rois, Atouts et Excuse."
      :links="[
        { label: 'Commencer un deck', icon: 'i-lucide-sparkles', to: '/decks/new', size: 'lg' },
        { label: 'Voir mes decks', icon: 'i-lucide-layout-dashboard', to: '/dashboard', color: 'neutral', variant: 'subtle', size: 'lg' }
      ]"
      :ui="{
        container: 'py-16 sm:py-20 lg:py-24',
        title: 'mx-auto max-w-3xl text-4xl sm:text-5xl',
        description: 'mx-auto max-w-2xl text-base sm:text-lg text-muted'
      }"
    >
      <template #bottom>
        <div class="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
          <div class="rounded-lg border border-default bg-default p-4">
            <UIcon
              name="i-lucide-upload"
              class="mb-3 size-5 text-primary"
            />
            <p class="font-medium text-highlighted">
              Import photos
            </p>
            <p class="mt-1 text-sm text-muted">
              Ajoutez plusieurs personnes et autorisez ou non la réutilisation.
            </p>
          </div>
          <div class="rounded-lg border border-default bg-default p-4">
            <UIcon
              name="i-lucide-wand-sparkles"
              class="mb-3 size-5 text-primary"
            />
            <p class="font-medium text-highlighted">
              Génération Gemini
            </p>
            <p class="mt-1 text-sm text-muted">
              Les visages deviennent figures, atouts et illustrations de deck.
            </p>
          </div>
          <div class="rounded-lg border border-default bg-default p-4">
            <UIcon
              name="i-lucide-download"
              class="mb-3 size-5 text-primary"
            />
            <p class="font-medium text-highlighted">
              Exports
            </p>
            <p class="mt-1 text-sm text-muted">
              Images individuelles, ZIP et PDF imprimable sont prévus dans le flux.
            </p>
          </div>
        </div>
      </template>
    </UPageHero>
  </UPage>
</template>
