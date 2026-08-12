<script setup lang="ts">
import { getRequestErrorMessage } from '~/utils/request-error'

definePageMeta({
  layout: 'default'
})

useSeoMeta({
  title: 'Connexion',
  robots: 'noindex, nofollow'
})

const route = useRoute()
const toast = useToast()
const { loggedIn, fetch: fetchSession } = useUserSession()
const oauthError = computed(() => route.query.error === 'oauth_failed')
const redirect = computed(() => typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard')
const emailLoading = ref(false)
const loginState = reactive({
  email: typeof route.query.email === 'string' ? route.query.email : '',
  password: ''
})

if (loggedIn.value) {
  await navigateTo('/dashboard')
}

if (redirect.value) {
  const redirectCookie = useCookie('auth-redirect', { maxAge: 60 * 5 })
  redirectCookie.value = redirect.value
}

function getLoginValidationMessage() {
  const email = loginState.email.trim()
  const password = loginState.password

  if (!email) {
    return 'L\'adresse email est requise'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Adresse email invalide'
  }

  if (!password) {
    return 'Le mot de passe est requis'
  }

  return null
}

async function loginWithEmail() {
  const validationMessage = getLoginValidationMessage()
  if (validationMessage) {
    toast.add({
      title: 'Connexion impossible',
      description: validationMessage,
      color: 'error'
    })
    return
  }

  emailLoading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: loginState.email.trim(),
        password: loginState.password
      }
    })
    await fetchSession()
    const next = useCookie('auth-redirect').value || '/dashboard'
    useCookie('auth-redirect').value = null
    await navigateTo(next)
  } catch (err: unknown) {
    toast.add({
      title: 'Connexion impossible',
      description: getRequestErrorMessage(err, 'Email ou mot de passe incorrect'),
      color: 'error'
    })
  } finally {
    emailLoading.value = false
  }
}
</script>

<template>
  <AuthPanel
    title="Connexion"
    description="Entrez pour retrouver vos decks et ouvrir une table."
  >
        <UAlert
          v-if="oauthError"
          class="mb-4"
          color="error"
          icon="i-lucide-alert-circle"
          title="Connexion impossible"
          description="La connexion Google a échoué. Veuillez réessayer."
        />

        <form
          class="space-y-4"
          @submit.prevent="loginWithEmail"
        >
          <UFormField
            label="Email"
            required
          >
            <UInput
              v-model="loginState.email"
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
              v-model="loginState.password"
              type="password"
              placeholder="Votre mot de passe"
              autocomplete="current-password"
              class="w-full"
            />
          </UFormField>

          <div class="text-right text-sm">
            <NuxtLink
              to="/auth/forgot-password"
              class="text-primary hover:underline"
            >
              Mot de passe oublié ?
            </NuxtLink>
          </div>

          <UButton
            type="submit"
            block
            size="lg"
            class="justify-center"
            :loading="emailLoading"
          >
            Se connecter avec mon email
          </UButton>
        </form>

        <div class="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted">
          <div class="h-px flex-1 bg-muted" />
          <span>ou</span>
          <div class="h-px flex-1 bg-muted" />
        </div>

        <UButton
          to="/auth/google"
          external
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

        <div class="mt-5 text-center text-sm text-muted">
          Pas encore de compte ?
          <NuxtLink
            to="/auth/register"
            class="text-primary hover:underline"
          >
            Créer un compte
          </NuxtLink>
        </div>
  </AuthPanel>
</template>
