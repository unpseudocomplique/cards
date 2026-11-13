<script setup lang="ts">
import type { DeckSettings } from '~/types/deck'
import type { CardFormatId } from '~~/shared/utils/printSpec'
import { CARD_FORMATS, PRINT_BLEED_MM, PRINT_CROP_MARK_LENGTH_MM, PRINT_DPI, PRINT_ICC_PROFILE, PRINT_SAFE_MM, allowedCardFormatsForDeckType, cardFormatRatio, formatTrimLabel } from '~~/shared/utils/printSpec'

const toast = useToast()
const { deckId, deck, stats, theme, format, backOutdated, patchSettings, refresh } = useDeckWorkspace()

/* Card format */
const formatChoices = computed(() => allowedCardFormatsForDeckType(deck.value!.type).map(id => CARD_FORMATS[id]))
const formatDescriptions: Record<CardFormatId, string> = {
  tarot: 'Le format du tarot français, plus allongé.',
  poker: 'Le format des cartes à jouer classiques.'
}
const pendingFormat = shallowRef<CardFormatId | null>(null)
const switchingFormat = shallowRef(false)
const readyFaces = computed(() => stats.value.ready)

async function confirmFormat() {
  if (!pendingFormat.value) {
    return
  }
  switchingFormat.value = true
  try {
    const result = await $fetch<{ outdatedCount: number }>(`/api/decks/${deckId.value}/format`, {
      method: 'PATCH',
      body: { cardFormat: pendingFormat.value }
    })
    await refresh()
    void refreshNuxtData('decks')
    toast.add({
      title: `Format ${formatTrimLabel(CARD_FORMATS[pendingFormat.value])}`,
      description: result.outdatedCount
        ? `${result.outdatedCount} carte${result.outdatedCount > 1 ? 's' : ''} à régénérer dans ce format.`
        : 'Les prochaines générations utiliseront ce format.',
      color: 'success',
      icon: 'i-lucide-ratio'
    })
    pendingFormat.value = null
  } catch (err) {
    toast.add({ title: 'Changement de format impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    switchingFormat.value = false
  }
}

const settings = computed(() => deck.value!.settings)
const backPrompt = shallowRef(settings.value.cardBackPrompt ?? '')
watch(() => settings.value.cardBackPrompt, (value) => {
  backPrompt.value = value ?? ''
})

const promptDirty = computed(() => backPrompt.value.trim() !== (settings.value.cardBackPrompt ?? ''))
const generatingBack = shallowRef(false)
const savingPrompt = shallowRef(false)
const exporting = shallowRef(false)
const lastExportUrl = shallowRef<string | null>(null)

async function savePrompt() {
  savingPrompt.value = true
  try {
    const updated = await $fetch<{ settings: DeckSettings }>(`/api/decks/${deckId.value}/prompt`, {
      method: 'PATCH',
      body: { cardBackPrompt: backPrompt.value.trim() || null }
    })
    patchSettings(updated.settings)
    toast.add({ title: 'Consigne du dos enregistrée', color: 'success', icon: 'i-lucide-check' })
  } catch (err) {
    toast.add({ title: 'Enregistrement impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    savingPrompt.value = false
  }
}

async function generateBack() {
  generatingBack.value = true
  try {
    const result = await $fetch<{ deck: { settings: DeckSettings } }>(`/api/decks/${deckId.value}/back/generate`, {
      method: 'POST',
      body: { prompt: backPrompt.value.trim() || undefined }
    })
    patchSettings(result.deck.settings)
    toast.add({ title: 'Dos généré', description: 'Il est commun à toutes les cartes du jeu.', color: 'success', icon: 'i-lucide-sparkles' })
  } catch (err) {
    toast.add({ title: 'Génération du dos impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    generatingBack.value = false
  }
}

async function exportPack() {
  exporting.value = true
  try {
    const result = await $fetch<{ url: string, cardCount: number, hasCardBack: boolean }>(`/api/decks/${deckId.value}/exports/print`, {
      method: 'POST'
    })
    lastExportUrl.value = result.url
    toast.add({
      title: 'Pack impression prêt',
      description: `${result.cardCount} face${result.cardCount > 1 ? 's' : ''}${result.hasCardBack ? ' et le dos' : ''}.`,
      color: 'success',
      icon: 'i-lucide-package-check',
      actions: [{ label: 'Télécharger', to: result.url, target: '_blank' }]
    })
    window.open(result.url, '_blank', 'noopener,noreferrer')
  } catch (err) {
    toast.add({ title: 'Export impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    exporting.value = false
  }
}

const specs = computed(() => [
  { label: 'Format', value: formatTrimLabel(format.value), icon: 'i-lucide-ruler' },
  { label: 'Résolution', value: `${PRINT_DPI} DPI`, icon: 'i-lucide-scan' },
  { label: 'Fond perdu', value: `${PRINT_BLEED_MM} mm de chaque côté`, icon: 'i-lucide-frame' },
  {
    label: 'Zone de sécurité',
    value: format.value.layout === 'band' ? `${PRINT_SAFE_MM} mm à l’intérieur de la coupe` : 'Non garantie (format poker)',
    icon: 'i-lucide-shield-check'
  },
  { label: 'Couleurs', value: `CMJN, ${PRINT_ICC_PROFILE.description}`, icon: 'i-lucide-palette' },
  { label: 'Traits de coupe', value: `${PRINT_CROP_MARK_LENGTH_MM} mm, hors fond perdu`, icon: 'i-lucide-scissors' },
  { label: 'Contenu', value: 'PDF recto (une carte par page), PDF verso, print-spec.json', icon: 'i-lucide-folder-archive' }
])
</script>

<template>
  <div class="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-2">
    <section class="lg:col-span-2">
      <h2 class="text-lg font-semibold text-highlighted">
        Format des cartes
      </h2>
      <p class="mt-1 mb-4 text-sm text-muted">
        Toutes les cartes du jeu et le dos partagent le même format.
      </p>

      <div class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="choice in formatChoices"
          :key="choice.id"
          type="button"
          role="radio"
          :aria-checked="format.id === choice.id"
          class="flex items-center gap-4 rounded-xl p-4 text-left ring transition outline-none focus-visible:ring-2 focus-visible:ring-primary"
          :class="format.id === choice.id ? 'bg-primary/8 ring-2 ring-primary' : 'ring-default hover:bg-elevated/60 hover:ring-accented'"
          @click="format.id !== choice.id && (pendingFormat = choice.id)"
        >
          <span
            class="w-9 shrink-0 rounded-[4px] border-2 border-current"
            :class="format.id === choice.id ? 'text-primary' : 'text-dimmed'"
            :style="{ aspectRatio: String(cardFormatRatio(choice)) }"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2 font-medium text-highlighted">
              {{ choice.label }}
              <UBadge
                v-if="format.id === choice.id"
                label="Actuel"
                size="sm"
                variant="subtle"
              />
            </span>
            <span class="block text-sm text-muted">{{ formatTrimLabel(choice) }} · {{ formatDescriptions[choice.id] }}</span>
          </span>
        </button>
      </div>

      <UAlert
        v-if="stats.outdated || backOutdated"
        class="mt-4"
        color="warning"
        variant="subtle"
        icon="i-lucide-ratio"
        title="Des images sont encore à l’ancien format"
        :description="[
          stats.outdated ? `${stats.outdated} carte${stats.outdated > 1 ? 's' : ''}` : null,
          backOutdated ? 'le dos' : null
        ].filter(Boolean).join(' et ') + ` : régénérez-les en ${formatTrimLabel(format)}. Elles ne sont ni imprimées ni utilisées à la table d’ici là.`"
      />
    </section>

    <section>
      <h2 class="text-lg font-semibold text-highlighted">
        Dos de carte
      </h2>
      <p class="mt-1 mb-6 text-sm text-muted">
        Un seul dos pour tout le jeu, avec le même contour que les faces.
      </p>

      <div class="flex flex-col gap-6 sm:flex-row">
        <div class="relative w-40 shrink-0 self-center sm:self-start">
          <img
            v-if="settings.cardBackImageUrl"
            :src="settings.cardBackImageUrl"
            alt="Dos de carte"
            class="w-full rounded-[5%] shadow-xl"
            :class="[generatingBack || backOutdated ? 'opacity-50' : '', backOutdated ? 'object-contain' : 'object-cover']"
            :style="{ aspectRatio: String(cardFormatRatio(format)) }"
          >
          <CardArt
            v-else
            :theme="theme"
            :format="format.id"
            glyph="?"
            class="shadow-xl"
            :class="generatingBack ? 'opacity-50' : ''"
          />
          <UBadge
            v-if="backOutdated && !generatingBack"
            label="Ancien format"
            color="warning"
            class="absolute bottom-3 left-1/2 -translate-x-1/2"
          />
          <div
            v-if="generatingBack"
            class="absolute inset-0 grid place-items-center"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-7 animate-spin text-primary"
            />
          </div>
        </div>

        <div class="flex flex-1 flex-col gap-3">
          <UFormField
            label="Motif"
            help="Facultatif. Le dos reprend toujours les couleurs du thème."
          >
            <UTextarea
              v-model="backPrompt"
              :rows="4"
              autoresize
              :maxlength="1600"
              placeholder="Rosace géométrique, fleurs de lys, symétrique…"
              class="w-full"
            />
          </UFormField>
          <div class="flex flex-wrap gap-2">
            <UButton
              :label="settings.cardBackImageUrl && !backOutdated ? 'Régénérer le dos' : 'Générer le dos'"
              icon="i-lucide-sparkles"
              :loading="generatingBack"
              @click="generateBack"
            />
            <UButton
              v-if="promptDirty"
              label="Enregistrer le motif"
              color="neutral"
              variant="subtle"
              :loading="savingPrompt"
              @click="savePrompt"
            />
          </div>
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-lg font-semibold text-highlighted">
        Pack pour l’imprimeur
      </h2>
      <p class="mt-1 mb-6 text-sm text-muted">
        Une archive ZIP prête à envoyer : un PDF recto avec une carte par page et un PDF verso pour le dos, en CMJN, avec fond perdu et traits de coupe.
      </p>

      <UCard variant="subtle">
        <dl class="divide-y divide-default">
          <div
            v-for="spec in specs"
            :key="spec.label"
            class="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <UIcon
              :name="spec.icon"
              class="size-4 shrink-0 text-muted"
            />
            <dt class="text-sm text-muted">
              {{ spec.label }}
            </dt>
            <dd class="ml-auto text-sm font-medium text-highlighted">
              {{ spec.value }}
            </dd>
          </div>
        </dl>

        <template #footer>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <UProgress
                :model-value="stats.ready"
                :max="stats.total || 1"
                size="sm"
                :color="stats.ready === stats.total ? 'success' : 'primary'"
                class="flex-1"
              />
              <span class="text-sm text-muted tabular-nums">{{ stats.ready }}/{{ stats.total }} faces</span>
            </div>
            <UAlert
              v-if="stats.ready && stats.ready < stats.total"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :title="`${stats.total - stats.ready} carte${stats.total - stats.ready > 1 ? 's' : ''} manquante${stats.total - stats.ready > 1 ? 's' : ''}`"
              description="Le pack ne contiendra que les faces déjà générées."
            />
            <UAlert
              v-if="!settings.cardBackImageUrl || backOutdated"
              color="neutral"
              variant="subtle"
              icon="i-lucide-info"
              :title="backOutdated ? 'Dos à l’ancien format' : 'Pas encore de dos'"
              :description="backOutdated ? 'Régénérez-le pour qu’il soit inclus dans le pack.' : 'Générez-le pour qu’il soit inclus dans le pack.'"
            />
            <UButton
              label="Télécharger le pack"
              icon="i-lucide-download"
              block
              size="lg"
              :loading="exporting"
              :disabled="!stats.ready"
              @click="exportPack"
            />
            <p
              v-if="lastExportUrl"
              class="text-center text-xs text-muted"
            >
              Le téléchargement ne s’est pas ouvert ?
              <ULink
                :to="lastExportUrl"
                target="_blank"
                class="text-primary"
              >
                Lien direct
              </ULink>
            </p>
          </div>
        </template>
      </UCard>
    </section>

    <UModal
      :open="Boolean(pendingFormat)"
      :title="pendingFormat ? `Passer au format ${formatTrimLabel(CARD_FORMATS[pendingFormat])} ?` : ''"
      :ui="{ footer: 'justify-end' }"
      @update:open="(value: boolean) => { if (!value) pendingFormat = null }"
    >
      <template #body>
        <div class="space-y-3 text-sm text-muted">
          <p>Les prochaines cartes et le dos seront générés dans ce format.</p>
          <p v-if="readyFaces || settings.cardBackImageUrl">
            Les images déjà créées
            <span class="font-medium text-highlighted">
              ({{ readyFaces }} carte{{ readyFaces > 1 ? 's' : '' }}{{ settings.cardBackImageUrl ? ' et le dos' : '' }})
            </span>
            restent visibles mais devront être régénérées : elles ne seront ni imprimées ni utilisées à la table d’ici là. Revenir au format actuel les réactive.
          </p>
        </div>
      </template>
      <template #footer>
        <UButton
          label="Annuler"
          color="neutral"
          variant="ghost"
          @click="pendingFormat = null"
        />
        <UButton
          label="Changer de format"
          icon="i-lucide-ratio"
          :loading="switchingFormat"
          @click="confirmFormat"
        />
      </template>
    </UModal>
  </div>
</template>
