<script setup lang="ts">
withDefaults(defineProps<{
  collapsed?: boolean
  to?: string
}>(), {
  collapsed: false,
  to: '/'
})

const { app } = useAppConfig()
</script>

<template>
  <NuxtLink
    :to="to"
    class="group inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :aria-label="`${app.name}, accueil`"
  >
    <span
      class="relative grid h-8 w-6 shrink-0 place-items-center rounded-[5px] bg-primary text-inverted shadow-sm shadow-primary/30 transition-transform duration-300 group-hover:-rotate-6"
      aria-hidden="true"
    >
      <span class="absolute inset-[3px] rounded-[3px] border border-white/35" />
      <span class="font-display text-base leading-none">C</span>
    </span>
    <span
      v-if="!collapsed"
      class="flex items-baseline gap-1 truncate"
    >
      <span class="font-display text-xl leading-none text-highlighted">{{ app.shortName }}</span>
      <span class="truncate text-xs text-muted">personnalisées</span>
    </span>
  </NuxtLink>
</template>
