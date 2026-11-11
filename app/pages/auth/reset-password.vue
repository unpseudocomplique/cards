<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import { getRequestErrorMessage } from '~/utils/request-error'

definePageMeta({
  layout: 'auth'
})

useSeoMeta({
  title: 'Nouveau mot de passe',
  robots: 'noindex, nofollow'
})

const route = useRoute()
const toast = useToast()
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')
const state = shallowRef<'checking' | 'invalid' | 'valid' | 'done'>('checking')
const invalidMessage = shallowRef('')
const loading = shallowRef(false)

const schema = z.object({
  newPassword: z.string().min(8, 'Au moins 8 caractères').max(128),
  confirmPassword: z.string()
}).refine(value => value.newPassword === value.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
})

type Schema = z.output<typeof schema>

const fields: AuthFormField[] = [{
  name: 'newPassword',
  type: 'password',
  label: 'Nouveau mot de passe',
  placeholder: '8 caractères minimum',
  autocomplete: 'new-password',
  required: true
}, {
  name: 'confirmPassword',
  type: 'password',
  label: 'Confirmation',
  autocomplete: 'new-password',
  required: true
}]

onMounted(async () => {
  if (!token.value) {
    state.value = 'invalid'
    invalidMessage.value = 'Le lien de réinitialisation est incomplet.'
    return
  }
  try {
    await $fetch('/api/auth/reset-password/validate', { query: { token: token.value } })
    state.value = 'valid'
  } catch (error) {
    state.value = 'invalid'
    invalidMessage.value = getRequestErrorMessage(error, 'Le lien est invalide ou a expiré.')
  }
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token: token.value, ...event.data }
    })
    state.value = 'done'
  } catch (error) {
    toast.add({
      title: 'Réinitialisation impossible',
      description: getRequestErrorMessage(error, 'Impossible de modifier le mot de passe'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UEmpty
    v-if="state === 'checking'"
    loading
    title="Vérification du lien…"
    variant="naked"
  />

  <UEmpty
    v-else-if="state === 'invalid'"
    icon="i-lucide-link-2-off"
    title="Lien inutilisable"
    :description="invalidMessage"
    variant="naked"
    :actions="[{ label: 'Demander un nouveau lien', to: '/auth/forgot-password' }]"
  />

  <UEmpty
    v-else-if="state === 'done'"
    icon="i-lucide-circle-check"
    title="Mot de passe mis à jour"
    description="Vous pouvez vous reconnecter avec votre nouveau mot de passe."
    variant="naked"
    :actions="[{ label: 'Se connecter', to: '/auth/login' }]"
  />

  <UAuthForm
    v-else
    :schema="schema"
    :fields="fields"
    :loading="loading"
    icon="i-lucide-lock-keyhole"
    title="Nouveau mot de passe"
    description="Choisissez un mot de passe d’au moins 8 caractères."
    :submit="{ label: 'Enregistrer', block: true }"
    @submit="onSubmit"
  />
</template>
