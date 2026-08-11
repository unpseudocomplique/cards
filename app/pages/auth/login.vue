<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

useSeoMeta({
  title: 'Connexion',
  robots: 'noindex, nofollow'
})

const route = useRoute()
const { loggedIn } = useUserSession()
const error = computed(() => route.query.error === 'oauth_failed')
const redirect = computed(() => typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard')

if (loggedIn.value) {
  await navigateTo('/dashboard')
}

if (redirect.value) {
  const redirectCookie = useCookie('auth-redirect', { maxAge: 60 * 5 })
  redirectCookie.value = redirect.value
}
</script>

<template>
  <UPage>
    <UPageSection :ui="{ container: 'max-w-md py-16 sm:py-24' }">
      <div class="rounded-lg border border-default bg-default p-6 shadow-sm">
        <div class="mb-6 text-center">
          <UIcon
            name="i-lucide-sparkles"
            class="mx-auto mb-3 size-8 text-primary"
          />
          <h1 class="text-2xl font-bold text-highlighted">
            Connexion
          </h1>
          <p class="mt-2 text-sm text-muted">
            Connectez-vous pour sauvegarder vos decks et importer vos photos.
          </p>
        </div>

        <UAlert
          v-if="error"
          class="mb-4"
          color="error"
          icon="i-lucide-alert-circle"
          title="Connexion impossible"
          description="La connexion Google a échoué. Veuillez réessayer."
        />

        <UButton
          to="/auth/google"
          block
          size="lg"
          color="neutral"
          variant="outline"
          class="justify-center"
        >
          <span class="inline-flex items-center gap-3">
            <UIcon
              name="i-simple-icons-google"
              class="size-5"
            />
            <span>Continuer avec Google</span>
          </span>
        </UButton>
      </div>
    </UPageSection>
  </UPage>
</template>
