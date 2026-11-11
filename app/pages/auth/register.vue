<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import { getRequestErrorMessage } from '~/utils/request-error'

definePageMeta({
  layout: 'auth'
})

useSeoMeta({
  title: 'Créer un compte',
  robots: 'noindex, nofollow'
})

const route = useRoute()
const toast = useToast()
const { loggedIn, fetch: fetchSession } = useUserSession()
const redirectCookie = useCookie<string | null>('auth-redirect', { maxAge: 60 * 5 })

if (loggedIn.value) {
  await navigateTo('/dashboard')
}

if (typeof route.query.redirect === 'string') {
  redirectCookie.value = route.query.redirect
}

const schema = z.object({
  username: z.string().trim().min(2, 'Au moins 2 caractères').max(30, 'Pseudo trop long'),
  email: z.email('Adresse email invalide'),
  password: z.string().min(8, 'Au moins 8 caractères').max(128),
  confirmPassword: z.string()
}).refine(value => value.password === value.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
})

type Schema = z.output<typeof schema>

const fields: AuthFormField[] = [{
  name: 'username',
  type: 'text',
  label: 'Pseudo',
  placeholder: 'Comment vous appeler à la table',
  autocomplete: 'nickname',
  required: true
}, {
  name: 'email',
  type: 'email',
  label: 'Email',
  placeholder: 'vous@exemple.com',
  autocomplete: 'email',
  required: true
}, {
  name: 'password',
  type: 'password',
  label: 'Mot de passe',
  placeholder: '8 caractères minimum',
  autocomplete: 'new-password',
  required: true
}, {
  name: 'confirmPassword',
  type: 'password',
  label: 'Confirmation',
  placeholder: 'Le même, encore une fois',
  autocomplete: 'new-password',
  required: true
}]

const providers = [{
  label: 'S’inscrire avec Google',
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
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: event.data
    })
    await fetchSession()
    toast.add({ title: 'Compte créé', description: 'Bienvenue !', color: 'success', icon: 'i-lucide-party-popper' })
    const next = redirectCookie.value || '/dashboard'
    redirectCookie.value = null
    await navigateTo(next)
  } catch (error) {
    toast.add({
      title: 'Inscription impossible',
      description: getRequestErrorMessage(error, 'Impossible de créer votre compte'),
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
    title="Créer un compte"
    separator="ou avec votre email"
    :submit="{ label: 'Créer mon compte', block: true }"
    @submit="onSubmit"
  >
    <template #description>
      Déjà inscrit ?
      <ULink
        to="/auth/login"
        class="font-medium text-primary"
      >
        Se connecter
      </ULink>
    </template>
  </UAuthForm>
</template>
