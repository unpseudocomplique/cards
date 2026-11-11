<script setup lang="ts">
import type { DeckCard } from '~/types/deck'
import { cardStatusMeta, cardSubtitle, cardSuit, suitMeta } from '~/utils/deckLabels'
import { cardFormatRatio, formatTrimLabel, resolveCardImageFormat } from '~~/shared/utils/printSpec'

const props = defineProps<{
  /** Ids of the cards the user can step through (current filter order). */
  ids: string[]
}>()

const cardId = defineModel<string | null>('cardId', { required: true })

const toast = useToast()
const { findCard, personFor, persons, theme, format, isOutdated, generateCard, assignCards, patchCard, deckId, job } = useDeckWorkspace()

const open = computed({
  get: () => Boolean(cardId.value),
  set: (value) => {
    if (!value) {
      cardId.value = null
    }
  }
})

const card = computed<DeckCard | null>(() => cardId.value ? findCard(cardId.value) : null)
const person = computed(() => card.value ? personFor(card.value) : null)
const position = computed(() => cardId.value ? props.ids.indexOf(cardId.value) : -1)
const status = computed(() => card.value ? cardStatusMeta[card.value.status] : null)
const red = computed(() => {
  const suit = card.value ? cardSuit(card.value) : null
  return Boolean(suit && suitMeta[suit].red)
})
const busy = computed(() => card.value?.status === 'generating' || card.value?.status === 'queued')
const outdated = computed(() => card.value ? isOutdated(card.value) : false)

function step(delta: number) {
  if (position.value < 0 || !props.ids.length) {
    return
  }
  const next = (position.value + delta + props.ids.length) % props.ids.length
  cardId.value = props.ids[next] ?? null
}

// Bound only while open, so arrow keys keep working on the page otherwise.
defineShortcuts(computed(() => open.value
  ? { arrowleft: () => step(-1), arrowright: () => step(1) }
  : {}))

/* Person */
const noPerson = '__none__'
const personItems = computed(() => [
  { value: noPerson, label: 'Aucune personne', avatar: undefined, description: undefined },
  ...persons.value.map(entry => ({
    value: entry.id,
    label: entry.label,
    description: `${entry.photos.length} photo${entry.photos.length > 1 ? 's' : ''}`,
    avatar: { src: entry.photos[0]?.url, alt: entry.label }
  }))
])
const assigning = shallowRef(false)

async function onPersonChange(value: string) {
  if (!card.value) {
    return
  }
  assigning.value = true
  await assignCards([card.value], value === noPerson ? null : value)
  assigning.value = false
}

/* Per-card prompt */
const promptDraft = shallowRef('')
const savingPrompt = shallowRef(false)

watch(card, (value, previous) => {
  if (value?.id !== previous?.id) {
    promptDraft.value = value?.prompt ?? ''
  }
}, { immediate: true })

const promptDirty = computed(() => (promptDraft.value.trim() || null) !== (card.value?.prompt ?? null))

async function savePrompt() {
  if (!card.value) {
    return
  }
  savingPrompt.value = true
  try {
    const updated = await $fetch<DeckCard>(`/api/decks/${deckId.value}/cards/${card.value.id}/prompt`, {
      method: 'PATCH',
      body: { prompt: promptDraft.value.trim() || null }
    })
    patchCard(updated)
    toast.add({ title: 'Détail enregistré', description: 'Il sera utilisé à la prochaine génération.', color: 'success', icon: 'i-lucide-check' })
  } catch (err) {
    toast.add({ title: 'Enregistrement impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    savingPrompt.value = false
  }
}

async function generate() {
  if (!card.value) {
    return
  }
  if (promptDirty.value) {
    await savePrompt()
  }
  const target = findCard(card.value.id)
  if (!target) {
    return
  }
  const result = await generateCard(target)
  void refreshNuxtData('decks')
  if (!result.ok) {
    toast.add({ title: 'Génération impossible', description: result.message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="card?.metadata.label ?? 'Carte'"
    :description="card ? cardSubtitle(card) : undefined"
    :ui="{ content: 'max-w-md', body: 'space-y-6', footer: 'gap-2' }"
  >
    <template #actions>
      <!-- No tooltips here: the dialog focuses its first button on open. -->
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          aria-label="Carte précédente"
          aria-keyshortcuts="ArrowLeft"
          @click="step(-1)"
        />
        <span class="text-xs text-muted tabular-nums">{{ position + 1 }}/{{ ids.length }}</span>
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          aria-label="Carte suivante"
          aria-keyshortcuts="ArrowRight"
          @click="step(1)"
        />
      </div>
    </template>

    <template
      v-if="card"
      #body
    >
      <div class="relative mx-auto w-full max-w-64">
        <img
          v-if="card.finalImageUrl"
          :src="card.finalImageUrl"
          :alt="card.metadata.label"
          class="w-full rounded-[5%] shadow-xl"
          :class="[outdated ? 'object-contain' : 'object-cover', busy ? 'opacity-60' : '']"
          :style="{ aspectRatio: String(cardFormatRatio(outdated ? resolveCardImageFormat(card.metadata) : format)) }"
        >
        <CardArt
          v-else
          :theme="theme"
          :format="format.id"
          :index="card.metadata.shortLabel"
          :red="red"
          :glyph="card.metadata.shortLabel.replace(/[♥♦♣♠]/g, '')"
          :image="person?.photos[0]?.url ?? null"
          muted
          class="shadow-xl"
        />
        <div
          v-if="busy"
          class="absolute inset-0 grid place-items-center rounded-[6%] bg-neutral-950/40 text-white"
        >
          <div class="flex flex-col items-center gap-2">
            <UIcon
              name="i-lucide-loader-circle"
              class="size-7 animate-spin"
            />
            <span class="text-sm font-medium">{{ status?.label }}…</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-center gap-2">
        <UBadge
          v-if="status"
          :label="status.label"
          :color="status.color"
          :icon="status.icon"
          variant="subtle"
        />
        <UButton
          v-if="card.finalImageUrl"
          :to="card.finalImageUrl"
          target="_blank"
          label="Pleine taille"
          icon="i-lucide-external-link"
          color="neutral"
          variant="ghost"
          size="xs"
        />
      </div>

      <UAlert
        v-if="outdated"
        color="warning"
        variant="subtle"
        icon="i-lucide-ratio"
        title="Image à l’ancien format"
        :description="`Elle date du format ${formatTrimLabel(resolveCardImageFormat(card.metadata))}. Régénérez la carte pour l’avoir en ${formatTrimLabel(format)}.`"
      />

      <UAlert
        v-if="card.status === 'failed' && card.errorMessage"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="La dernière génération a échoué"
        :description="card.errorMessage"
      />

      <UFormField
        label="Personne sur la carte"
        :help="persons.length ? undefined : 'Ajoutez d’abord des personnes dans l’onglet Personnes.'"
      >
        <USelectMenu
          :model-value="card.sourcePersonId ?? noPerson"
          :items="personItems"
          value-key="value"
          :avatar="person ? { src: person.photos[0]?.url, alt: person.label } : undefined"
          :icon="person ? undefined : 'i-lucide-user-round-x'"
          :loading="assigning"
          :disabled="!persons.length || busy"
          :search-input="persons.length > 6 ? { placeholder: 'Rechercher…' } : false"
          class="w-full"
          @update:model-value="onPersonChange($event as string)"
        />
      </UFormField>

      <UFormField
        label="Détail pour cette carte"
        help="Optionnel. Ajouté au style du deck pour cette carte uniquement."
      >
        <UTextarea
          v-model="promptDraft"
          :rows="3"
          autoresize
          :maxlength="1200"
          placeholder="Sourire franc, manteau bleu, tient une rose…"
          class="w-full"
        />
        <div
          v-if="promptDirty"
          class="mt-2 flex justify-end gap-2"
        >
          <UButton
            label="Annuler"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="promptDraft = card.prompt ?? ''"
          />
          <UButton
            label="Enregistrer"
            size="xs"
            color="neutral"
            variant="subtle"
            :loading="savingPrompt"
            @click="savePrompt"
          />
        </div>
      </UFormField>
    </template>

    <template
      v-if="card"
      #footer
    >
      <UButton
        :label="card.finalImageUrl ? 'Régénérer' : 'Générer'"
        :icon="card.finalImageUrl ? 'i-lucide-refresh-cw' : 'i-lucide-sparkles'"
        block
        size="lg"
        :loading="busy"
        :disabled="!card.sourcePersonId || Boolean(job)"
        @click="generate"
      />
    </template>
  </USlideover>
</template>
