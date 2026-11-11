<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'

const colorMode = useColorMode()
const { app } = useAppConfig()

const themeColor = computed(() => colorMode.value === 'dark' ? '#09090b' : '#ffffff')

useHead({
  meta: [
    { key: 'theme-color', name: 'theme-color', content: themeColor }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'fr'
  }
})

useSeoMeta({
  titleTemplate: title => title ? `${title} · ${app.name}` : `${app.name} — ${app.tagline}`,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp
    :locale="fr"
    :toaster="{ position: 'bottom-right', duration: 4000 }"
  >
    <NuxtLoadingIndicator
      color="var(--ui-primary)"
      :height="2"
    />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
