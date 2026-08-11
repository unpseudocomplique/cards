<script setup lang="ts">
import { getRequestErrorMessage } from '~/utils/request-error'

definePageMeta({
  layout: 'default'
})

useSeoMeta({
  title: 'Inscription',
  robots: 'noindex, nofollow'
})

const route = useRoute()
const toast = useToast()
const { loggedIn, fetch: fetchSession } = useUserSession()
const registerLoading = ref(false)
const registerState = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

if (loggedIn.value) {
  await navigateTo('/dashboard')
}

const redirectTo = route.query.redirect as string | undefined
if (redirectTo) {
  const redirectCookie = useCookie('auth-redirect', { maxAge: 60 * 5 })
  redirectCookie.value = redirectTo
}

async function registerWithEmail() {
  registerLoading.value = true

  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: registerState
    })

    await fetchSession()

    toast.add({
      title: 'Compte créé',
      description: 'Bienvenue !',
      color: 'success'
    })

    const redirect = useCookie('auth-redirect').value || '/dashboard'
    useCookie('auth-redirect').value = null
    await navigateTo(redirect)
  } catch (error: unknown) {
    toast.add({
      title: 'Inscription impossible',
      description: getRequestErrorMessage(error, 'Impossible de créer votre compte'),
      color: 'error'
    })
  } finally {
    registerLoading.value = false
  }
}
</script>

<template>
  <UPage>
    <UPageSection :ui="{ container: 'max-w-md py-16 sm:py-24' }">
      <div class="rounded-lg border border-default bg-default p-6 shadow-sm">
        <div class="mb-6 text-center">
          <UIcon
            name="i-lucide-user-plus"
            class="mx-auto mb-3 size-8 text-primary"
          />
          <h1 class="text-2xl font-bold text-highlighted">
            Créer un compte
          </h1>
          <p class="mt-2 text-sm text-muted">
            Inscrivez-vous avec votre email pour sauvegarder vos decks.
          </p>
        </div>

        <form
          class="space-y-4"
          @submit.prevent="registerWithEmail"
        >
          <UFormField
            label="Nom d'utilisateur"
            required
          >
            <UInput
              v-model="registerState.username"
              placeholder="Votre pseudo"
              autocomplete="username"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Email"
            required
          >
            <UInput
              v-model="registerState.email"
              type="email"
              placeholder="vous@exemple.com"
              autocomplete="email"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Mot de passe"
            required
          >
            <UInput
              v-model="registerState.password"
              type="password"
              placeholder="8 caractères minimum"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Confirmer le mot de passe"
            required
          >
            <UInput
              v-model="registerState.confirmPassword"
              type="password"
              placeholder="Retapez votre mot de passe"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            block
            size="lg"
            class="justify-center"
            :loading="registerLoading"
          >
            Créer mon compte
          </UButton>
        </form>

        <div class="mt-5 text-center text-sm text-muted">
          Déjà inscrit ?
          <NuxtLink
            to="/auth/login"
            class="text-primary hover:underline"
          >
            Se connecter
          </NuxtLink>
        </div>
      </div>
    </UPageSection>
  </UPage>
</template>
