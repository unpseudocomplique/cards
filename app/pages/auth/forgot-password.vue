<script setup lang="ts">
import { getRequestErrorMessage } from '~/utils/request-error'

definePageMeta({
  layout: 'default'
})

useSeoMeta({
  title: 'Mot de passe oublié',
  robots: 'noindex, nofollow'
})

const route = useRoute()
const toast = useToast()
const loading = ref(false)
const submittedEmail = ref('')
const state = reactive({
  email: typeof route.query.email === 'string' ? route.query.email : ''
})

async function requestResetLink() {
  loading.value = true

  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: state
    })

    submittedEmail.value = state.email
    toast.add({
      title: 'Demande envoyée',
      description: 'Si un compte existe, un lien de réinitialisation vient d’être envoyé.',
      color: 'success'
    })
  } catch (error: unknown) {
    toast.add({
      title: 'Envoi impossible',
      description: getRequestErrorMessage(error, 'Impossible de demander le lien de réinitialisation'),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthPanel
    :title="submittedEmail ? 'Regardez votre boîte mail' : 'Mot de passe oublié'"
    :description="submittedEmail
      ? 'Un lien de récupération a été préparé si le compte existe.'
      : 'Entrez votre e-mail pour recevoir un lien, même si vous utilisez Google.'"
  >
        <div
          v-if="submittedEmail"
          class="space-y-5"
        >
          <div class="rounded-lg border border-default bg-muted/40 p-4 text-sm leading-6 text-toned">
            Un e-mail a été préparé pour
            <span class="font-semibold text-highlighted">{{ submittedEmail }}</span>.
            Si le compte existe, le lien sera valable 30 minutes.
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <UButton
              color="primary"
              size="lg"
              class="justify-center"
              @click="submittedEmail = ''"
            >
              Réessayer
            </UButton>

            <UButton
              to="/auth/login"
              color="neutral"
              variant="outline"
              size="lg"
              class="justify-center"
            >
              Retour à la connexion
            </UButton>
          </div>
        </div>

        <form
          v-else
          class="space-y-4"
          @submit.prevent="requestResetLink"
        >
          <UFormField
            label="Email"
            required
          >
            <UInput
              v-model="state.email"
              type="email"
              placeholder="vous@exemple.com"
              autocomplete="email"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            block
            size="lg"
            class="justify-center"
            :loading="loading"
          >
            Envoyer le lien de récupération
          </UButton>
        </form>

        <div class="mt-5 text-center text-sm text-muted">
          Vous vous souvenez de votre mot de passe ?
          <NuxtLink
            to="/auth/login"
            class="text-primary hover:underline"
          >
            Revenir à la connexion
          </NuxtLink>
        </div>
  </AuthPanel>
</template>
