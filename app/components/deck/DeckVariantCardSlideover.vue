<script setup lang="ts">
import { cardStatusMeta, cardSubtitle, cardSuit, suitMeta } from '~/utils/deckLabels'
import { cardFormatRatio, formatTrimLabel, resolveCardImageFormat } from '~~/shared/utils/printSpec'

const props = defineProps<{
  variantId: string
  /** Ids of the deck cards the user can step through (current view order). */
  ids: string[]
}>()

const cardId = defineModel<string | null>('cardId', { required: true })

const toast = useToast()
const {
  deckId,
  persons,
  personById,
  theme,
  format,
  isOutdated,
  isClassic,
  findCard,
  findVariant,
  overrideFor,
  isGenerating,
  overrideCard,
  resetCard,
  generateVariantCard
} = useDeckVariants()

const open = computed({
  get: () => Boolean(cardId.value),
  set: (value) => {
    if (!value) {
      cardId.value = null
    }
  }
})

const variant = computed(() => findVariant(props.variantId))
const base = computed(() => cardId.value ? findCard(cardId.value) : null)
const override = computed(() => base.value ? overrideFor(variant.value, base.value.id) : null)
const generating = computed(() => base.value ? isGenerating(props.variantId, base.value.id) : false)
const card = computed(() => {
  if (!base.value) {
    return null
  }
  const view = variantCardView(base.value, override.value)
  return generating.value ? { ...view, status: 'generating' as const } : view
})
const person = computed(() => card.value?.sourcePersonId ? personById.value.get(card.value.sourcePersonId) ?? null : null)
const basePerson = computed(() => base.value?.sourcePersonId ? personById.value.get(base.value.sourcePersonId) ?? null : null)
const classic = computed(() => base.value ? isClassic(base.value) : false)
const outdated = computed(() => card.value ? isOutdated(card.value) : false)
const status = computed(() => card.value ? cardStatusMeta[card.value.status] : null)
const busy = computed(() => card.value?.status === 'generating' || card.value?.status === 'queued')
const red = computed(() => {
  const suit = base.value ? cardSuit(base.value) : null
  return Boolean(suit && suitMeta[suit].red)
})
const position = computed(() => cardId.value ? props.ids.indexOf(cardId.value) : -1)

function step(delta: number) {
  if (position.value < 0 || !props.ids.length) {
    return
  }
  const next = (position.value + delta + props.ids.length) % props.ids.length
  cardId.value = props.ids[next] ?? null
}

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
    description: entry.id === base.value?.sourcePersonId ? 'Comme dans le deck' : `${entry.photos.length} photo${entry.photos.length > 1 ? 's' : ''}`,
    avatar: { src: entry.photos[0]?.url, alt: entry.label }
  }))
])
const saving = shallowRef(false)

async function onPersonChange(value: string) {
  if (!base.value) {
    return
  }
  saving.value = true
  await overrideCard(props.variantId, base.value.id, { personId: value === noPerson ? null : value })
  saving.value = false
}

/* Prompt: empty = same as the deck card. */
const promptDraft = shallowRef('')

watch([() => base.value?.id, () => override.value?.id], () => {
  promptDraft.value = override.value?.prompt ?? ''
}, { immediate: true })

const promptDirty = computed(() => (promptDraft.value.trim() || null) !== (override.value?.prompt ?? null))

async function savePrompt() {
  if (!base.value) {
    return false
  }
  saving.value = true
  const saved = await overrideCard(props.variantId, base.value.id, { prompt: promptDraft.value.trim() || null })
  saving.value = false
  if (saved) {
    toast.add({ title: 'Consigne enregistrée', description: 'Elle sera utilisée à la prochaine génération.', color: 'success', icon: 'i-lucide-check' })
  }
  return Boolean(saved)
}

async function startOverride() {
  if (!base.value) {
    return
  }
  saving.value = true
  await overrideCard(props.variantId, base.value.id, {})
  saving.value = false
}

const resetting = shallowRef(false)

async function reset() {
  if (!base.value) {
    return
  }
  resetting.value = true
  if (await resetCard(props.variantId, base.value.id)) {
    toast.add({ title: 'Carte synchronisée avec le deck', color: 'success', icon: 'i-lucide-link' })
  }
  resetting.value = false
}

async function generate() {
  if (!base.value) {
    return
  }
  if (promptDirty.value && !await savePrompt()) {
    return
  }
  const result = await generateVariantCard(props.variantId, base.value.id)
  if (!result.ok) {
    toast.add({ title: 'Génération impossible', description: result.message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="base?.metadata.label ?? 'Carte'"
    :description="base ? `${cardSubtitle(base)} · ${variant?.name ?? 'Variante'}` : undefined"
    :ui="{ content: 'max-w-md', body: 'space-y-6', footer: 'flex-col gap-2' }"
  >
    <template #actions>
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          aria-label="Carte précédente"
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
          @click="step(1)"
        />
      </div>
    </template>

    <template
      v-if="card && base"
      #body
    >
      <div class="flex items-end justify-center gap-4">
        <div class="relative w-full max-w-56">
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

        <!-- The deck card, for comparison -->
        <div
          v-if="override && base.finalImageUrl"
          class="w-20 shrink-0"
        >
          <img
            :src="base.finalImageUrl"
            :alt="`${base.metadata.label} dans le deck`"
            class="w-full rounded-[5%] object-cover opacity-80 shadow"
            :style="{ aspectRatio: String(cardFormatRatio(format)) }"
          >
          <p class="mt-1 text-center text-[11px] text-muted">
            Dans le deck
          </p>
        </div>
      </div>

      <div class="flex items-center justify-center gap-2">
        <UBadge
          v-if="override"
          label="Modifiée dans la variante"
          icon="i-lucide-pencil"
          variant="subtle"
        />
        <UBadge
          v-else
          label="Synchronisée avec le deck"
          icon="i-lucide-link"
          color="neutral"
          variant="subtle"
        />
        <UBadge
          v-if="status && override"
          :label="status.label"
          :color="status.color"
          variant="subtle"
        />
      </div>

      <UAlert
        v-if="classic"
        color="neutral"
        variant="subtle"
        icon="i-lucide-spade"
        title="Design classique"
        description="Les as et cartes chiffrées au design classique sont les mêmes dans toutes les variantes."
      />

      <template v-else-if="!override">
        <p class="text-sm text-muted">
          Cette carte est celle du deck<span v-if="basePerson">, avec {{ basePerson.label }}</span>. Elle suivra tous ses changements tant que vous ne la modifiez pas ici.
        </p>
        <UFormField label="Personne sur la carte dans cette variante">
          <USelectMenu
            :model-value="base.sourcePersonId ?? noPerson"
            :items="personItems"
            value-key="value"
            :loading="saving"
            :disabled="!persons.length"
            :search-input="persons.length > 6 ? { placeholder: 'Rechercher…' } : false"
            class="w-full"
            @update:model-value="($event as string) !== (base.sourcePersonId ?? noPerson) && onPersonChange($event as string)"
          />
        </UFormField>
        <UButton
          label="Modifier seulement la consigne"
          icon="i-lucide-message-square-text"
          color="neutral"
          variant="link"
          size="sm"
          class="px-0"
          :loading="saving"
          @click="startOverride"
        />
      </template>

      <template v-else>
        <UAlert
          v-if="outdated"
          color="warning"
          variant="subtle"
          icon="i-lucide-ratio"
          title="Image à l’ancien format"
          :description="`Régénérez la carte pour l’avoir en ${formatTrimLabel(format)}.`"
        />
        <UAlert
          v-if="card.status === 'failed' && card.errorMessage"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="La dernière génération a échoué"
          :description="card.errorMessage"
        />
        <UAlert
          v-else-if="!override.finalImageUrl && !busy"
          color="warning"
          variant="subtle"
          icon="i-lucide-sparkles"
          title="Pas encore d’image pour cette variante"
          description="Générez la carte pour qu’elle puisse être imprimée avec la variante."
        />

        <UFormField label="Personne sur la carte">
          <USelectMenu
            :model-value="override.sourcePersonId ?? noPerson"
            :items="personItems"
            value-key="value"
            :avatar="person ? { src: person.photos[0]?.url, alt: person.label } : undefined"
            :icon="person ? undefined : 'i-lucide-user-round-x'"
            :loading="saving"
            :disabled="!persons.length || busy"
            :search-input="persons.length > 6 ? { placeholder: 'Rechercher…' } : false"
            class="w-full"
            @update:model-value="onPersonChange($event as string)"
          />
        </UFormField>

        <UFormField
          label="Consigne pour cette carte"
          :help="override.prompt ? 'Remplace la consigne de la carte du deck dans cette variante.' : 'Vide : même consigne que la carte du deck.'"
        >
          <UTextarea
            v-model="promptDraft"
            :rows="3"
            autoresize
            :maxlength="1200"
            :placeholder="base.prompt ? `Comme dans le deck : ${base.prompt}` : 'Ex. avec ses deux chiens assis à ses pieds…'"
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
              @click="promptDraft = override.prompt ?? ''"
            />
            <UButton
              label="Enregistrer"
              size="xs"
              color="neutral"
              variant="subtle"
              :loading="saving"
              @click="savePrompt"
            />
          </div>
        </UFormField>

        <p class="text-xs text-muted">
          Les consignes du jeu, des couleurs, des types et de la personne s’appliquent comme pour le deck.
          <ULink
            :to="`/decks/${deckId}/style`"
            class="text-primary"
          >
            Style du jeu
          </ULink>
        </p>
      </template>
    </template>

    <template
      v-if="card && override && !classic"
      #footer
    >
      <UButton
        :label="override.finalImageUrl ? 'Régénérer pour cette variante' : 'Générer pour cette variante'"
        :icon="override.finalImageUrl ? 'i-lucide-refresh-cw' : 'i-lucide-sparkles'"
        block
        size="lg"
        :loading="busy"
        :disabled="!override.sourcePersonId || busy"
        @click="generate"
      />
      <UButton
        label="Revenir à la carte du deck"
        icon="i-lucide-undo-2"
        block
        color="neutral"
        variant="ghost"
        :loading="resetting"
        :disabled="busy"
        @click="reset"
      />
    </template>
  </USlideover>
</template>
