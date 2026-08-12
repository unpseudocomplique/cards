<script setup lang="ts">
</script>

<template>
  <div class="salon-wash flex min-h-dvh flex-col">
    <AppHeader :links="navLinks" />
    <div class="flex-1 pt-[calc(var(--ui-header-height)+0.35rem)]">
      <slot />
    </div>
    <AppFooter />
  </div>
</template>
