<script setup lang="ts">
/** A wood and brass plaque holding one section of the statistics page. */
defineProps<{
  title?: string
  subtitle?: string
  icon?: string
}>()
</script>

<template>
  <section class="table-plaque min-w-0 rounded-xl p-4 sm:p-5">
    <header
      v-if="title"
      class="mb-4 flex items-start gap-3"
    >
      <span
        v-if="icon"
        class="grid size-9 shrink-0 place-items-center rounded-full border border-[#c9a463]/70 bg-[#1c0f07]/60 text-[#e9c77f]"
      >
        <UIcon
          :name="icon"
          class="size-4.5"
        />
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="font-display text-2xl leading-none text-[#f6e7c4] sm:text-[1.7rem]">
          {{ title }}
        </h2>
        <p
          v-if="subtitle"
          class="mt-1 text-xs text-[#f6e7c4]/60"
        >
          {{ subtitle }}
        </p>
      </div>
      <slot name="aside" />
    </header>
    <slot />
  </section>
</template>
