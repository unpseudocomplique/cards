<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import { getRequestErrorMessage } from '~/utils/request-error'

definePageMeta({
  layout: 'auth'
})

useSeoMeta({
  title: 'Connexion',
  robots: 'noindex, nofollow'
})

const route = useRoute()
const toast = useToast()
const { loggedIn, fetch: fetchSession } = useUserSession()

const oauthError = computed(() => route.query.error === 'oauth_failed')
const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
const redirectCookie = useCookie<string | null>('auth-redirect', { maxAge: 60 * 5 })

if (loggedIn.value) {
  await navigateTo(redirect || '/dashboard')
}

if (redirect) {
  redirectCookie.value = redirect
}

const schema = z.object({
  email: z.email('Adresse email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis')
})

type Schema = z.output<typeof schema>

const fields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: 'Email',
  placeholder: 'vous@exemple.com',
  autocomplete: 'email',
  defaultValue: typeof route.query.email === 'string' ? route.query.email : undefined,
  required: true
}, {
  name: 'password',
  type: 'password',
  label: 'Mot de passe',
  placeholder: 'Votre mot de passe',
  autocomplete: 'current-password',
  required: true
}]

const providers = [{
  label: 'Continuer avec Google',
  icon: 'i-simple-icons-google',
  to: '/auth/google',
  external: true,
  color: 'neutral' as const,
  variant: 'subtle' as const
}]

const loading = shallowRef(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: event.data.email.trim(), password: event.data.password }
    })
    await fetchSession()
    const next = redirectCookie.value || '/dashboard'
    redirectCookie.value = null
    await navigateTo(next)
  } catch (error) {
    toast.add({
      title: 'Connexion impossible',
      description: getRequestErrorMessage(error, 'Email ou mot de passe incorrect'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UAuthForm
    :schema="schema"
    :fields="fields"
    :providers="providers"
    :loading="loading"
    title="Bon retour"
    separator="ou avec votre email"
    :submit="{ label: 'Se connecter', block: true }"
    @submit="onSubmit"
  >
    <template #description>
      Pas encore de compte ?
      <ULink
        to="/auth/register"
        class="font-medium text-primary"
      >
        Créer un compte
      </ULink>
    </template>

    <template #password-hint>
      <ULink
        to="/auth/forgot-password"
        class="text-primary"
        tabindex="-1"
      >
        Mot de passe oublié ?
      </ULink>
    </template>

    <template
      v-if="oauthError"
      #validation
    >
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="La connexion Google a échoué. Réessayez."
      />
    </template>
  </UAuthForm>
</template>
