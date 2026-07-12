<script setup lang="ts">
</script>

<template>
  <div>
    <UContainer class="min-h-dvh border-default px-3 pt-14 sm:border-x sm:px-4 sm:pt-16">
      <AppHeader :links="navLinks" />
      <slot />
      <AppFooter />
    </UContainer>
  </div>
</template>
