<script setup lang="ts">
const { footer } = useAppConfig()
</script>

<template>
  <footer class="mt-auto border-t border-default/70 bg-muted/30">
    <div class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-end sm:justify-between sm:px-6">
      <div>
        <AppWordmark />
        <p class="mt-3 max-w-[36ch] text-sm text-pretty text-muted">
          Tarot français en salon 3D, avec des decks dessinés à partir de vos photos.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <NuxtLink
          to="/play"
          class="text-toned hover:text-highlighted"
        >
          Jouer
        </NuxtLink>
        <NuxtLink
          to="/decks/new"
          class="text-toned hover:text-highlighted"
        >
          Créer un deck
        </NuxtLink>
        <NuxtLink
          to="/dashboard"
          class="text-toned hover:text-highlighted"
        >
          Mes decks
        </NuxtLink>
      </div>
    </div>
    <div class="border-t border-default/60">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p class="text-xs text-muted">
          {{ footer.credits }}
        </p>
        <ColorModeButton />
      </div>
    </div>
  </footer>
</template>
