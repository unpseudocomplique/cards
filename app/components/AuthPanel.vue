<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <div class="mx-auto w-full max-w-md py-4 sm:py-10">
    <div class="rounded-2xl border border-default/80 bg-elevated/40 p-5 shadow-[0_24px_60px_-32px_oklch(0.2_0.04_40_/_0.55)] sm:p-7">
      <div class="mb-6">
        <p class="text-xs tracking-[0.2em] text-primary uppercase">
          Salon
        </p>
        <h1 class="mt-2 font-serif text-3xl tracking-tight text-highlighted">
          {{ title }}
        </h1>
        <p class="mt-2 text-sm text-pretty text-muted">
          {{ description }}
        </p>
      </div>
      <slot />
    </div>
  </div>
</template>
