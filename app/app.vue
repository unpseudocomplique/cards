<script setup lang="ts">
import { fr } from '@nuxt/ui/locale'

const colorMode = useColorMode()
const { app } = useAppConfig()
const route = useRoute()

/** At the table the hand fills the bottom of the screen: notices drop from the top there. */
const toaster = computed(() => ({
  position: route.path.startsWith('/play/') ? 'top-center' as const : 'bottom-right' as const,
  duration: 4000
}))

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
    :toaster="toaster"
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
