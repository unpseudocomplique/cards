<script setup lang="ts">
import type { DeckDetails } from '~/types/deck'
import { PRINT_DPI, PRINT_BLEED_MM, POKER_TRIM_MM, TAROT_TRIM_MM } from '~~/shared/utils/printSpec'

const props = defineProps<{
  deckId: string
  deckType: DeckDetails['deck']['type']
  settings: DeckDetails['deck']['settings']
  readyCardCount: number
  cardCount: number
}>()

const emit = defineEmits<{
  'deck-settings-updated': [settings: Partial<DeckDetails['deck']['settings']>]
}>()

const toast = useToast()
const backPromptDraft = shallowRef(props.settings.cardBackPrompt || '')
const isSavingBackPrompt = shallowRef(false)
const isGeneratingBack = shallowRef(false)
const isExporting = shallowRef(false)
const lastExportUrl = shallowRef<string | null>(null)

watch(() => props.settings.cardBackPrompt, (value) => {
  backPromptDraft.value = value || ''
})

const trimLabel = computed(() => {
  if (props.deckType === 'tarot78') {
    return `${TAROT_TRIM_MM.width} × ${TAROT_TRIM_MM.height} mm (atouts 9:16)`
  }

  return `${POKER_TRIM_MM.width} × ${POKER_TRIM_MM.height} mm`
})

async function saveBackPrompt() {
  isSavingBackPrompt.value = true

  try {
    const updatedDeck = await $fetch<{ settings: DeckDetails['deck']['settings'] }>(`/api/decks/${props.deckId}/prompt`, {
      method: 'PATCH',
      body: { cardBackPrompt: backPromptDraft.value.trim() || null }
    })

    emit('deck-settings-updated', updatedDeck.settings)
    toast.add({
      title: 'Prompt du dos enregistré',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (error) {
    toast.add({
      title: 'Enregistrement impossible',
      description: getApiErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    isSavingBackPrompt.value = false
  }
}

async function generateBack() {
  isGeneratingBack.value = true

  try {
    const result = await $fetch<{
      cardBackImageUrl: string
      cardBackFoilUrl: string
      deck: { settings: DeckDetails['deck']['settings'] }
    }>(`/api/decks/${props.deckId}/back/generate`, {
      method: 'POST',
      body: { prompt: backPromptDraft.value.trim() || undefined }
    })

    emit('deck-settings-updated', result.deck.settings)
    toast.add({
      title: 'Dos généré',
      description: 'Aperçu + masque de dorure prêts.',
      color: 'success',
      icon: 'i-lucide-sparkles'
    })
  } catch (error) {
    toast.add({
      title: 'Génération du dos impossible',
      description: getApiErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    isGeneratingBack.value = false
  }
}

async function exportPrintPack() {
  if (!props.readyCardCount) {
    toast.add({
      title: 'Aucune carte prête',
      description: 'Générez au moins une face avant l’export impression.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  isExporting.value = true

  try {
    const result = await $fetch<{
      url: string
      cardCount: number
      hasCardBack: boolean
    }>(`/api/decks/${props.deckId}/exports/print`, {
      method: 'POST'
    })

    lastExportUrl.value = result.url
    toast.add({
      title: 'Pack impression prêt',
      description: `${result.cardCount} face(s)${result.hasCardBack ? ' + dos' : ''} · dorures incluses.`,
      color: 'success',
      icon: 'i-lucide-package'
    })

    if (import.meta.client && result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer')
    }
  } catch (error) {
    toast.add({
      title: 'Export impossible',
      description: getApiErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-alert-circle'
    })
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="space-y-4 rounded-xl border border-default bg-default p-4 sm:p-5">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="font-medium text-highlighted">
          Impression & dorure
        </p>
        <p class="mt-1 text-sm text-muted">
          Pack print {{ PRINT_DPI }} DPI · fond perdu {{ PRINT_BLEED_MM }} mm · masques de dorure générés dans l’app.
        </p>
      </div>
      <UBadge
        color="neutral"
        variant="subtle"
        class="w-fit shrink-0"
      >
        {{ readyCardCount }}/{{ cardCount }} faces
      </UBadge>
    </div>

    <div class="grid gap-3 text-sm text-muted sm:grid-cols-3">
      <div class="rounded-lg bg-muted/50 p-3">
        <p class="font-medium text-highlighted">
          Format
        </p>
        <p class="mt-1">
          {{ trimLabel }}
        </p>
      </div>
      <div class="rounded-lg bg-muted/50 p-3">
        <p class="font-medium text-highlighted">
          Dorure
        </p>
        <p class="mt-1">
          Or du costume + cadres (masque noir/blanc)
        </p>
      </div>
      <div class="rounded-lg bg-muted/50 p-3">
        <p class="font-medium text-highlighted">
          Export
        </p>
        <p class="mt-1">
          ZIP faces · foil · dos · spec
        </p>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-[1fr_14rem]">
      <div class="space-y-3">
        <UFormField
          label="Prompt du dos"
          hint="Motif symétrique full-bleed. L’or du dessin devient le masque de dorure (pas de cadre rectangulaire ajouté)."
        >
          <UTextarea
            v-model="backPromptDraft"
            :rows="3"
            class="w-full"
            placeholder="Ex. motif floral géométrique bleu nuit et or, symétrique, élégant…"
          />
        </UFormField>

        <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-save"
            :loading="isSavingBackPrompt"
            @click="saveBackPrompt"
          >
            Enregistrer le prompt
          </UButton>
          <UButton
            icon="i-lucide-layers"
            :loading="isGeneratingBack"
            @click="generateBack"
          >
            Générer le dos
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-download"
            :loading="isExporting"
            :disabled="!readyCardCount"
            @click="exportPrintPack"
          >
            Télécharger le pack impression
          </UButton>
        </div>

        <p
          v-if="lastExportUrl"
          class="text-xs text-muted"
        >
          Dernier export :
          <a
            :href="lastExportUrl"
            class="underline"
            target="_blank"
            rel="noopener noreferrer"
          >lien direct</a>
        </p>
      </div>

      <div class="overflow-hidden rounded-xl border border-default bg-muted/40 p-2">
        <NuxtImg
          v-if="settings.cardBackImageUrl"
          :src="settings.cardBackImageUrl"
          alt="Dos de carte"
          class="mx-auto aspect-3/4 w-full max-w-[11rem] rounded-[8%] object-contain"
        />
        <div
          v-else
          class="flex aspect-3/4 w-full flex-col items-center justify-center gap-2 rounded-[8%] border border-dashed border-default bg-default/70 p-3 text-center"
        >
          <UIcon
            name="i-lucide-rectangle-vertical"
            class="size-6 text-muted"
          />
          <span class="text-xs text-muted">Pas encore de dos</span>
        </div>
        <p
          v-if="settings.cardBackFoilUrl"
          class="mt-2 text-center text-[11px] text-muted"
        >
          card-back-foil = masque dorure (or du motif)
        </p>
      </div>
    </div>
  </div>
</template>
