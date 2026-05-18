<script setup lang="ts">
</script>

<template>
  <div>
    <UContainer class="min-h-dvh sm:border-x border-default pt-14">
      <AppHeader :links="navLinks" />
      <slot />
      <AppFooter />
    </UContainer>
  </div>
</template>
