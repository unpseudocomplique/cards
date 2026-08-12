<script setup lang="ts">
defineProps<{
  compact?: boolean
}>()
</script>

<template>
  <NuxtLink
    to="/"
    class="group min-h-11 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :class="compact ? 'inline-flex sm:hidden' : 'hidden sm:inline-flex'"
    aria-label="Cartes personnalisées, accueil"
  >
    <span
      class="relative grid size-8 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30"
      aria-hidden="true"
    >
      <span class="font-serif text-lg leading-none text-primary">T</span>
    </span>
    <span
      v-if="!compact"
      class="flex flex-col leading-none"
    >
      <span class="font-serif text-lg tracking-tight text-highlighted">Cartes</span>
      <span class="mt-0.5 text-[10px] tracking-[0.18em] text-muted uppercase">Personnalisées</span>
    </span>
  </NuxtLink>
</template>
