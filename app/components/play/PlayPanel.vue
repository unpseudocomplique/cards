<script setup lang="ts">
/** Wood and brass panel laid over the table (king call, écart, summaries). */
defineProps<{
  title: string
  description?: string
  icon?: string
}>()
</script>

<template>
  <section class="table-plaque relative w-full rounded-2xl p-4 sm:p-5 short:px-4 short:py-3">
    <header class="flex items-start gap-3">
      <div
        v-if="icon"
        class="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#f6d98c] to-[#c9922f] text-[#3a2208] shadow-md ring-2 ring-[#fff0c4]/70"
      >
        <UIcon
          :name="icon"
          class="size-4.5"
        />
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="font-display text-2xl leading-tight text-[#f6e7c4] short:text-xl">
          {{ title }}
        </h2>
        <p
          v-if="description"
          class="mt-0.5 text-sm text-[#f6e7c4]/65 short:text-xs"
        >
          {{ description }}
        </p>
      </div>
      <slot name="aside" />
    </header>
    <div class="mt-4 short:mt-2">
      <slot />
    </div>
    <footer
      v-if="$slots.footer"
      class="mt-4 flex flex-wrap items-center justify-end gap-3 short:mt-2"
    >
      <slot name="footer" />
    </footer>
  </section>
</template>
