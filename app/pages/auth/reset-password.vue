<script setup lang="ts">
import { getRequestErrorMessage } from '~/utils/request-error'

definePageMeta({
  layout: 'default'
})

useSeoMeta({
  title: 'Réinitialiser le mot de passe',
  robots: 'noindex, nofollow'
})

const route = useRoute()
const toast = useToast()
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')
const validationState = ref<'checking' | 'invalid' | 'valid'>('checking')
const validationMessage = ref('')
const resetComplete = ref(false)
const resetLoading = ref(false)
const passwordState = reactive({
  newPassword: '',
  confirmPassword: ''
})

async function validateToken() {
  if (!token.value) {
    validationState.value = 'invalid'
    validationMessage.value = 'Le lien de réinitialisation est incomplet.'
    return
  }

  try {
    await $fetch('/api/auth/reset-password/validate', {
      query: {
        token: token.value
      }
    })

    validationState.value = 'valid'
    validationMessage.value = ''
  } catch (error: unknown) {
    validationState.value = 'invalid'
    validationMessage.value = getRequestErrorMessage(error, 'Le lien de réinitialisation est invalide ou a expiré.')
  }
}

async function resetPassword() {
  resetLoading.value = true

  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: token.value,
        ...passwordState
      }
    })

    resetComplete.value = true
    toast.add({
      title: 'Mot de passe mis à jour',
      description: 'Vous pouvez maintenant vous reconnecter avec votre nouveau mot de passe.',
      color: 'success'
    })
  } catch (error: unknown) {
    toast.add({
      title: 'Réinitialisation impossible',
      description: getRequestErrorMessage(error, 'Impossible de modifier le mot de passe'),
      color: 'error'
    })
  } finally {
    resetLoading.value = false
  }
}

onMounted(() => {
  validateToken()
})
</script>

<template>
  <UPage>
    <UPageSection :ui="{ container: 'max-w-md py-16 sm:py-24' }">
      <div class="rounded-lg border border-default bg-default p-6 shadow-sm">
        <div class="mb-6 text-center">
          <UIcon
            name="i-lucide-lock-keyhole"
            class="mx-auto mb-3 size-8 text-primary"
          />
          <h1 class="text-2xl font-bold text-highlighted">
            {{ resetComplete ? 'Mot de passe mis à jour' : 'Réinitialisation du mot de passe' }}
          </h1>
          <p class="mt-2 text-sm text-muted">
            {{ resetComplete
              ? 'Votre nouveau mot de passe est prêt.'
              : 'Choisissez un nouveau mot de passe pour reprendre la main.' }}
          </p>
        </div>

        <div
          v-if="validationState === 'checking'"
          class="space-y-4 text-center"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="mx-auto size-7 animate-spin text-primary"
          />
          <p class="text-sm text-muted">
            Vérification du lien en cours...
          </p>
        </div>

        <div
          v-else-if="validationState === 'invalid'"
          class="space-y-5"
        >
          <UAlert
            color="error"
            icon="i-lucide-alert-circle"
            title="Lien invalide"
            :description="validationMessage"
          />

          <div class="grid gap-3 sm:grid-cols-2">
            <UButton
              to="/auth/forgot-password"
              color="primary"
              size="lg"
              class="justify-center"
            >
              Demander un nouveau lien
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

        <div
          v-else-if="resetComplete"
          class="space-y-5"
        >
          <UAlert
            color="success"
            icon="i-lucide-check-circle"
            title="C’est prêt"
            description="Votre mot de passe a été réinitialisé. Vous pouvez vous reconnecter."
          />

          <UButton
            to="/auth/login"
            block
            color="primary"
            size="lg"
            class="justify-center"
          >
            Se connecter
          </UButton>
        </div>

        <form
          v-else
          class="space-y-4"
          @submit.prevent="resetPassword"
        >
          <UFormField
            label="Nouveau mot de passe"
            required
          >
            <UInput
              v-model="passwordState.newPassword"
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
              v-model="passwordState.confirmPassword"
              type="password"
              placeholder="Retapez votre mot de passe"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            block
            color="primary"
            size="lg"
            class="justify-center"
            :loading="resetLoading"
          >
            Enregistrer le nouveau mot de passe
          </UButton>
        </form>
      </div>
    </UPageSection>
  </UPage>
</template>
