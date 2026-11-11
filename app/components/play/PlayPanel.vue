<script setup lang="ts">
/** Glass panel floating over the 3D table. */
defineProps<{
  title: string
  description?: string
  icon?: string
}>()
</script>

<template>
  <section class="w-full rounded-2xl bg-neutral-950/80 p-4 text-white shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-xl sm:p-5">
    <header class="flex items-start gap-3">
      <div
        v-if="icon"
        class="grid size-9 shrink-0 place-items-center rounded-full bg-amber-300/15 text-amber-200"
      >
        <UIcon
          :name="icon"
          class="size-4.5"
        />
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="font-display text-2xl leading-tight text-amber-50">
          {{ title }}
        </h2>
        <p
          v-if="description"
          class="mt-0.5 text-sm text-white/60"
        >
          {{ description }}
        </p>
      </div>
      <slot name="aside" />
    </header>
    <div class="mt-4">
      <slot />
    </div>
    <footer
      v-if="$slots.footer"
      class="mt-4 flex flex-wrap items-center justify-end gap-2"
    >
      <slot name="footer" />
    </footer>
  </section>
</template>
