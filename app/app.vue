<script setup lang="ts">
const colorMode = useColorMode()

const color = computed(() => colorMode.value === 'dark' ? '#1c1612' : '#f6f1e8')

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'fr'
  }
})

useSeoMeta({
  titleTemplate: '%s · Cartes personnalisées',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <a
      href="#contenu"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-inverted"
    >
      Aller au contenu
    </a>
    <NuxtLayout>
      <UMain
        id="contenu"
        class="relative"
        tabindex="-1"
      >
        <NuxtPage />
      </UMain>
    </NuxtLayout>
  </UApp>
</template>
