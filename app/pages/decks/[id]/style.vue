<script setup lang="ts">
import type { CardRolePromptKey, CardSuitPromptKey, DeckSettings } from '~/types/deck'
import type { CardThemeId } from '~~/shared/utils/cardThemes'
import { getCardTheme } from '~~/shared/utils/cardThemes'
import { mergeRolePrompts, mergeSuitPrompts } from '~~/shared/utils/cardPromptPresets'
import { cardRole, cardSuit, roleMeta, suitMeta } from '~/utils/deckLabels'
import { visualStylePresets } from '~/utils/stylePresets'

const toast = useToast()
const { deckId, deck, cards, stats, format, patchSettings } = useDeckWorkspace()

const settings = computed(() => deck.value!.settings)

const presentRoles = computed(() => {
  const present = new Set(cards.value.map(cardRole))
  return (Object.keys(roleMeta) as CardRolePromptKey[])
    .filter(role => present.has(role))
    .sort((a, b) => roleMeta[a].order - roleMeta[b].order)
})

const presentSuits = computed(() => {
  const present = new Set(cards.value.map(cardSuit).filter(Boolean))
  return (Object.keys(suitMeta) as CardSuitPromptKey[]).filter(suit => present.has(suit))
})

function snapshot(source: DeckSettings) {
  return {
    colorTheme: getCardTheme(source.colorTheme).id as CardThemeId,
    visualStyle: source.visualStyle ?? '',
    rolePrompts: { ...mergeRolePrompts(source.rolePrompts) } as Record<CardRolePromptKey, string>,
    suitPrompts: { ...mergeSuitPrompts(source.suitPrompts) } as Record<CardSuitPromptKey, string>
  }
}

const saved = computed(() => snapshot(settings.value))
const draft = ref(snapshot(settings.value))

watch(saved, () => {
  draft.value = snapshot(settings.value)
})

const changedRoles = computed(() => presentRoles.value.filter(role => draft.value.rolePrompts[role].trim() !== saved.value.rolePrompts[role]))
const changedSuits = computed(() => presentSuits.value.filter(suit => draft.value.suitPrompts[suit].trim() !== saved.value.suitPrompts[suit]))
const themeChanged = computed(() => draft.value.colorTheme !== saved.value.colorTheme)
const styleChanged = computed(() => draft.value.visualStyle.trim() !== saved.value.visualStyle)
const dirty = computed(() => themeChanged.value || styleChanged.value || changedRoles.value.length > 0 || changedSuits.value.length > 0)

const roleTab = shallowRef<CardRolePromptKey | undefined>()
const suitTab = shallowRef<CardSuitPromptKey | undefined>()
watchEffect(() => {
  if (!roleTab.value || !presentRoles.value.includes(roleTab.value)) {
    roleTab.value = presentRoles.value[0]
  }
  if (!suitTab.value || !presentSuits.value.includes(suitTab.value)) {
    suitTab.value = presentSuits.value[0]
  }
})

const saving = shallowRef(false)

/** Order in which prompt layers apply (server/utils/cardPromptBuilder.ts). */
const promptOrder = [
  { label: 'Jeu', where: 'style ci-dessus', icon: 'i-lucide-layers' },
  { label: 'Couleur', where: 'ci-dessous', icon: 'i-lucide-heart' },
  { label: 'Type', where: 'ci-dessous', icon: 'i-lucide-crown' },
  { label: 'Personne', where: 'onglet Personnes', icon: 'i-lucide-user-round' },
  { label: 'Carte', where: 'onglet Cartes', icon: 'i-lucide-square-pen' }
]

function reset() {
  draft.value = snapshot(settings.value)
}

async function save() {
  const visualStyle = draft.value.visualStyle.trim()
  if (visualStyle.length < 3) {
    toast.add({ title: 'Style manquant', description: 'Décrivez le style en quelques mots.', color: 'warning', icon: 'i-lucide-triangle-alert' })
    return
  }
  const emptyPrompt = [...changedRoles.value.map(role => draft.value.rolePrompts[role]), ...changedSuits.value.map(suit => draft.value.suitPrompts[suit])]
    .some(text => text.trim().length < 3)
  if (emptyPrompt) {
    toast.add({ title: 'Consigne trop courte', description: 'Chaque consigne doit faire au moins 3 caractères.', color: 'warning', icon: 'i-lucide-triangle-alert' })
    return
  }

  saving.value = true
  try {
    const body: Record<string, unknown> = { visualStyle, colorTheme: draft.value.colorTheme }
    if (changedRoles.value.length) {
      body.rolePrompts = Object.fromEntries(changedRoles.value.map(role => [role, draft.value.rolePrompts[role].trim()]))
    }
    if (changedSuits.value.length) {
      body.suitPrompts = Object.fromEntries(changedSuits.value.map(suit => [suit, draft.value.suitPrompts[suit].trim()]))
    }
    const updated = await $fetch<{ settings: DeckSettings }>(`/api/decks/${deckId.value}/prompt`, {
      method: 'PATCH',
      body
    })
    patchSettings(updated.settings)
    toast.add({
      title: 'Style enregistré',
      description: stats.value.ready ? 'Les prochaines générations l’utiliseront. Régénérez les cartes prêtes pour harmoniser le jeu.' : undefined,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (err) {
    toast.add({ title: 'Enregistrement impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-10 pb-20">
    <section>
      <h2 class="text-lg font-semibold text-highlighted">
        Thème de couleurs
      </h2>
      <p class="mt-1 mb-4 text-sm text-muted">
        Palette des illustrations, cadre, index et dos : tout le jeu partage le même thème.
      </p>
      <DeckThemePicker
        v-model="draft.colorTheme"
        :format="format.id"
      />
      <UAlert
        v-if="themeChanged && stats.ready"
        class="mt-4"
        color="info"
        variant="subtle"
        icon="i-lucide-palette"
        title="Pensez à régénérer"
        :description="`${stats.ready} carte${stats.ready > 1 ? 's' : ''} et le dos utilisent encore l’ancien thème.`"
      />
    </section>

    <section>
      <h2 class="text-lg font-semibold text-highlighted">
        Style des illustrations
      </h2>
      <p class="mt-1 mb-4 text-sm text-muted">
        Technique, époque, ambiance… en langage courant.
      </p>
      <div class="mb-3 flex flex-wrap gap-1.5">
        <UButton
          v-for="preset in visualStylePresets"
          :key="preset.label"
          :label="preset.label"
          size="xs"
          :color="draft.visualStyle === preset.value ? 'primary' : 'neutral'"
          :variant="draft.visualStyle === preset.value ? 'soft' : 'outline'"
          class="rounded-full"
          @click="draft.visualStyle = preset.value"
        />
      </div>
      <UTextarea
        v-model="draft.visualStyle"
        :rows="3"
        autoresize
        :maxlength="1600"
        class="w-full"
      />
    </section>

    <section>
      <h2 class="text-lg font-semibold text-highlighted">
        Consignes par couleur et par type
      </h2>
      <p class="mt-1 mb-4 text-sm text-muted">
        Facultatif. Les valeurs par défaut conviennent à la plupart des jeux.
      </p>

      <div
        class="mb-6 rounded-xl bg-elevated/50 p-4 ring ring-default"
        aria-label="Ordre d’application des consignes"
      >
        <p class="text-sm font-medium text-highlighted">
          Comment les consignes se combinent
        </p>
        <ol class="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <template
            v-for="(step, index) in promptOrder"
            :key="step.label"
          >
            <li class="flex items-center gap-1.5 rounded-full bg-default px-2.5 py-1 ring ring-default">
              <UIcon
                :name="step.icon"
                class="size-3.5 text-muted"
              />
              <span class="font-medium text-highlighted">{{ step.label }}</span>
              <span class="text-muted">· {{ step.where }}</span>
            </li>
            <UIcon
              v-if="index < promptOrder.length - 1"
              name="i-lucide-chevron-right"
              class="size-3.5 text-dimmed"
              aria-hidden="true"
            />
          </template>
        </ol>
        <p class="mt-3 text-xs text-muted">
          Chaque génération les applique dans cet ordre. Quand deux consignes se contredisent, la plus précise l’emporte :
          une consigne de carte (« avec ses chiens ») passe avant celle de la personne (« sans ses chiens »).
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <UCard
          variant="subtle"
          :ui="{ body: 'space-y-3' }"
        >
          <p class="text-sm font-medium text-highlighted">
            Par couleur
          </p>
          <USelect
            v-model="suitTab"
            :items="presentSuits.map(suit => ({
              label: `${suitMeta[suit].symbol}  ${suitMeta[suit].label}${changedSuits.includes(suit) ? ' •' : ''}`,
              value: suit
            }))"
            class="w-full"
          />
          <UTextarea
            v-if="suitTab"
            v-model="draft.suitPrompts[suitTab]"
            :rows="5"
            autoresize
            :maxlength="1600"
            class="w-full"
          />
        </UCard>
        <UCard
          variant="subtle"
          :ui="{ body: 'space-y-3' }"
        >
          <p class="text-sm font-medium text-highlighted">
            Par type de carte
          </p>
          <USelect
            v-model="roleTab"
            :items="presentRoles.map(role => ({
              label: `${roleMeta[role].plural}${changedRoles.includes(role) ? ' •' : ''}`,
              value: role
            }))"
            class="w-full"
          />
          <UTextarea
            v-if="roleTab"
            v-model="draft.rolePrompts[roleTab]"
            :rows="5"
            autoresize
            :maxlength="1600"
            class="w-full"
          />
        </UCard>
      </div>
    </section>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-4 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div
        v-if="dirty"
        class="sticky bottom-4 z-20 mx-auto flex w-full max-w-xl items-center gap-3 rounded-2xl bg-elevated/95 p-2 pl-4 shadow-2xl ring ring-accented backdrop-blur"
      >
        <UIcon
          name="i-lucide-pencil-line"
          class="size-4 shrink-0"
        />
        <span class="flex-1 text-sm font-medium text-highlighted">Modifications non enregistrées</span>
        <UButton
          label="Annuler"
          size="sm"
          color="neutral"
          variant="ghost"
          @click="reset"
        />
        <UButton
          label="Enregistrer"
          size="sm"
          :loading="saving"
          @click="save"
        />
      </div>
    </Transition>
  </div>
</template>
