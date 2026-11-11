<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import { getRequestErrorMessage } from '~/utils/request-error'

definePageMeta({
  layout: 'auth'
})

useSeoMeta({
  title: 'Mot de passe oublié',
  robots: 'noindex, nofollow'
})

const route = useRoute()
const toast = useToast()
const loading = shallowRef(false)
const submittedEmail = shallowRef('')

const schema = z.object({
  email: z.email('Adresse email invalide')
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
}]

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: event.data
    })
    submittedEmail.value = event.data.email
  } catch (error) {
    toast.add({
      title: 'Envoi impossible',
      description: getRequestErrorMessage(error, 'Impossible d’envoyer le lien'),
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
    v-if="submittedEmail"
    icon="i-lucide-mail-check"
    title="Regardez votre boîte mail"
    :description="`Si un compte existe pour ${submittedEmail}, un lien valable 30 minutes vient de partir.`"
    variant="naked"
    :actions="[
      { label: 'Retour à la connexion', to: '/auth/login' },
      { label: 'Renvoyer', color: 'neutral', variant: 'subtle', onClick: () => { submittedEmail = '' } }
    ]"
  />

  <UAuthForm
    v-else
    :schema="schema"
    :fields="fields"
    :loading="loading"
    icon="i-lucide-key-round"
    title="Mot de passe oublié"
    description="Recevez un lien pour en choisir un nouveau, même si vous utilisez Google."
    :submit="{ label: 'Envoyer le lien', block: true }"
    @submit="onSubmit"
  >
    <template #footer>
      <ULink
        to="/auth/login"
        class="text-sm text-muted hover:text-default"
      >
        ← Revenir à la connexion
      </ULink>
    </template>
  </UAuthForm>
</template>
