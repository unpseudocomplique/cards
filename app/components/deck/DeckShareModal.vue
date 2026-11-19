<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

const toast = useToast()
const config = useRuntimeConfig()
const { deckId, deck, data } = useDeckWorkspace()
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })

const busy = shallowRef<'enable' | 'renew' | 'disable' | null>(null)
const token = computed(() => deck.value?.shareToken ?? null)

// The browser origin is the one friends will open; the configured site URL is the SSR fallback.
const origin = shallowRef(String(config.public.siteUrl).replace(/\/$/, ''))
onMounted(() => {
  origin.value = window.location.origin
})

const link = computed(() => token.value ? `${origin.value}/partage/${token.value}` : '')

function setToken(shareToken: string | null) {
  if (data.value) {
    data.value = { ...data.value, deck: { ...data.value.deck, shareToken } }
  }
}

async function enable(renew = false) {
  busy.value = renew ? 'renew' : 'enable'
  try {
    const result = await $fetch<{ shareToken: string }>(`/api/decks/${deckId.value}/share`, {
      method: 'POST',
      body: { renew }
    })
    setToken(result.shareToken)
    if (renew) {
      toast.add({ title: 'Nouveau lien créé', description: 'L’ancien lien ne fonctionne plus.', color: 'success', icon: 'i-lucide-check' })
    }
  } catch (err) {
    toast.add({ title: 'Partage impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = null
  }
}

async function disable() {
  busy.value = 'disable'
  try {
    await $fetch(`/api/decks/${deckId.value}/share`, { method: 'DELETE' })
    setToken(null)
    toast.add({ title: 'Lien désactivé', description: 'Plus personne ne peut ouvrir ce deck avec l’ancien lien.', color: 'success', icon: 'i-lucide-link-2-off' })
  } catch (err) {
    toast.add({ title: 'Désactivation impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Partager ce deck"
    description="Vos amis voient les cartes prêtes, sans compte et sans pouvoir rien modifier."
  >
    <template #body>
      <div
        v-if="token"
        class="flex flex-col gap-4"
      >
        <div class="flex gap-2">
          <UInput
            :model-value="link"
            readonly
            class="min-w-0 flex-1"
            aria-label="Lien de partage"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <UButton
            :label="copied ? 'Copié' : 'Copier'"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            :color="copied ? 'success' : 'primary'"
            @click="copy(link)"
          />
        </div>
        <ul class="flex flex-col gap-1.5 text-sm text-muted">
          <li class="flex gap-2">
            <UIcon
              name="i-lucide-eye"
              class="mt-0.5 size-4 shrink-0"
            />
            Lecture seule : seules les faces terminées et le dos sont visibles, pas vos photos ni vos réglages.
          </li>
          <li class="flex gap-2">
            <UIcon
              name="i-lucide-refresh-cw"
              class="mt-0.5 size-4 shrink-0"
            />
            Les nouvelles cartes générées apparaissent automatiquement.
          </li>
        </ul>
        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-default pt-4">
          <UButton
            :to="link"
            target="_blank"
            label="Ouvrir"
            icon="i-lucide-external-link"
            color="neutral"
            variant="ghost"
            size="sm"
          />
          <div class="flex gap-2">
            <UButton
              label="Nouveau lien"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="busy === 'renew'"
              :disabled="Boolean(busy)"
              @click="enable(true)"
            />
            <UButton
              label="Désactiver"
              icon="i-lucide-link-2-off"
              color="error"
              variant="soft"
              size="sm"
              :loading="busy === 'disable'"
              :disabled="Boolean(busy)"
              @click="disable"
            />
          </div>
        </div>
      </div>

      <div
        v-else
        class="flex flex-col items-start gap-4"
      >
        <p class="text-sm text-default">
          Créez un lien secret à envoyer à vos amis. Vous pourrez le désactiver à tout moment.
        </p>
        <UButton
          label="Créer le lien de partage"
          icon="i-lucide-link"
          :loading="busy === 'enable'"
          @click="enable()"
        />
      </div>
    </template>
  </UModal>
</template>
