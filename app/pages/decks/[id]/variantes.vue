<script setup lang="ts">
import type { DropdownMenuItem, TabsItem } from '@nuxt/ui'
import { VARIANT_NAME_MAX } from '~~/shared/utils/deckVariants'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const {
  deckId,
  cards,
  variants,
  theme,
  format,
  isOutdated,
  personById,
  findVariant,
  overrideFor,
  printStatus,
  isGenerating,
  createVariant,
  renameVariant,
  deleteVariant,
  generatePending
} = useDeckVariants()

/* Selected variant, kept in the URL so it survives a reload. */
const variantId = computed({
  get: () => {
    const fromQuery = typeof route.query.v === 'string' ? route.query.v : null
    return findVariant(fromQuery)?.id ?? variants.value[0]?.id ?? null
  },
  set: (value) => {
    void router.replace({ query: { ...route.query, v: value || undefined } })
  }
})
const variant = computed(() => findVariant(variantId.value))
const status = computed(() => printStatus(variant.value))

const variantTabs = computed<TabsItem[]>(() => variants.value.map(entry => ({
  label: entry.name,
  value: entry.id,
  badge: entry.cards.length ? entry.cards.length : undefined
})))

/* Cards shown: the whole deck, or only the changed ones. */
const show = shallowRef<'all' | 'changed'>('all')
const showTabs = computed<TabsItem[]>(() => [
  { label: 'Tout le jeu', value: 'all', badge: cards.value.length },
  { label: 'Modifiées', value: 'changed', badge: variant.value?.cards.length ?? 0 }
])

const views = computed(() => cards.value.map((card) => {
  const override = overrideFor(variant.value, card.id)
  const view = variantCardView(card, override)
  return {
    base: card,
    override,
    view: isGenerating(variantId.value ?? '', card.id) ? { ...view, status: 'generating' as const } : view
  }
}))
const visible = computed(() => show.value === 'changed' ? views.value.filter(entry => entry.override) : views.value)
const visibleIds = computed(() => visible.value.map(entry => entry.base.id))

const pendingCount = computed(() => (variant.value?.cards ?? [])
  .filter(card => card.sourcePersonId && card.status !== 'ready').length)
const generatingAny = computed(() => (variant.value?.cards ?? []).some(card => isGenerating(variant.value!.id, card.baseCardId)))

const openCardId = shallowRef<string | null>(null)

/* Create / rename / delete */
const nameModal = shallowRef<'create' | 'rename' | null>(null)
const nameDraft = shallowRef('')
const savingName = shallowRef(false)

function openCreate() {
  nameDraft.value = variants.value.length ? `Variante ${variants.value.length + 1}` : 'Variante 1'
  nameModal.value = 'create'
}

function openRename() {
  nameDraft.value = variant.value?.name ?? ''
  nameModal.value = 'rename'
}

async function saveName() {
  const name = nameDraft.value.trim()
  if (!name) {
    return
  }
  savingName.value = true
  if (nameModal.value === 'create') {
    const created = await createVariant(name)
    if (created) {
      variantId.value = created.id
      show.value = 'all'
      nameModal.value = null
      toast.add({ title: 'Variante créée', description: 'Ouvrez une carte pour la modifier dans cette variante.', color: 'success', icon: 'i-lucide-copy-plus' })
    }
  } else if (variant.value && await renameVariant(variant.value.id, name)) {
    nameModal.value = null
  }
  savingName.value = false
}

const deleteOpen = shallowRef(false)
const deleting = shallowRef(false)

async function confirmDelete() {
  if (!variant.value) {
    return
  }
  deleting.value = true
  const name = variant.value.name
  if (await deleteVariant(variant.value.id)) {
    variantId.value = null
    toast.add({ title: `« ${name} » supprimée`, color: 'success', icon: 'i-lucide-check' })
  }
  deleting.value = false
  deleteOpen.value = false
}

const menu = computed<DropdownMenuItem[][]>(() => [[
  { label: 'Renommer', icon: 'i-lucide-pencil', onSelect: openRename }
], [
  { label: 'Supprimer la variante', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => { deleteOpen.value = true } }
]])
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="max-w-2xl">
        <h2 class="text-lg font-semibold text-highlighted">
          Variantes d’impression
        </h2>
        <p class="mt-1 text-sm text-muted">
          Une variante reprend toutes les cartes du deck et suit ses changements. Seules les cartes que vous y modifiez sont différentes, par exemple une autre personne sur une carte. À l’impression, chaque variante choisie donne un jeu complet.
        </p>
      </div>
      <UButton
        v-if="variants.length"
        label="Nouvelle variante"
        icon="i-lucide-copy-plus"
        color="neutral"
        variant="outline"
        @click="openCreate"
      />
    </div>

    <UEmpty
      v-if="!variants.length"
      icon="i-lucide-copy-plus"
      title="Aucune variante"
      description="Créez une variante pour imprimer une autre version du jeu, avec quelques cartes différentes."
      :actions="[{ label: 'Créer une variante', icon: 'i-lucide-copy-plus', onClick: openCreate }]"
      class="mx-auto mt-6 max-w-md"
    />

    <template v-else-if="variant">
      <div class="-mx-1 overflow-x-auto px-1">
        <UTabs
          :model-value="variantId ?? undefined"
          :items="variantTabs"
          :content="false"
          size="sm"
          class="w-max"
          @update:model-value="variantId = String($event)"
        />
      </div>

      <div class="sticky -top-4 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b border-default bg-default/85 px-4 py-3 backdrop-blur sm:-top-6 sm:-mx-6 sm:px-6 lg:-top-8 lg:-mx-8 lg:px-8">
        <UTabs
          v-model="show"
          :items="showTabs"
          :content="false"
          variant="link"
          size="sm"
        />
        <p class="text-sm text-muted">
          <template v-if="status.overridden">
            {{ status.overridden }} carte{{ status.overridden > 1 ? 's' : '' }} modifiée{{ status.overridden > 1 ? 's' : '' }},
            les autres suivent le deck.
          </template>
          <template v-else>
            Identique au deck pour l’instant.
          </template>
        </p>

        <div class="ml-auto flex items-center gap-2">
          <UButton
            v-if="pendingCount || generatingAny"
            :label="generatingAny ? 'Génération…' : `Générer ${pendingCount}`"
            icon="i-lucide-sparkles"
            size="sm"
            :loading="generatingAny"
            :disabled="generatingAny"
            @click="generatePending(variant.id)"
          />
          <UButton
            label="Imprimer"
            icon="i-lucide-printer"
            size="sm"
            color="neutral"
            variant="outline"
            :to="{ path: `/decks/${deckId}/impression`, query: { v: variant.id } }"
          />
          <UDropdownMenu
            :items="menu"
            :content="{ align: 'end' }"
          >
            <UButton
              icon="i-lucide-ellipsis"
              size="sm"
              color="neutral"
              variant="ghost"
              square
              aria-label="Actions de la variante"
            />
          </UDropdownMenu>
        </div>
      </div>

      <DeckVariantBack :variant-id="variant.id" />

      <UAlert
        v-if="status.missing"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`${status.missing} carte${status.missing > 1 ? 's' : ''} modifiée${status.missing > 1 ? 's' : ''} sans image`"
        description="Générez-les avant d’imprimer cette variante : une carte modifiée n’est jamais remplacée par celle du deck."
      />

      <div
        v-if="visible.length"
        class="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]"
      >
        <DeckCardTile
          v-for="entry in visible"
          :key="entry.base.id"
          :card="entry.view"
          :person="entry.view.sourcePersonId ? personById.get(entry.view.sourcePersonId) ?? null : null"
          :theme="theme"
          :format="format"
          :outdated="isOutdated(entry.view)"
          :tag="entry.override ? 'Modifiée' : undefined"
          @open="openCardId = entry.base.id"
        />
      </div>

      <UEmpty
        v-else
        icon="i-lucide-mouse-pointer-click"
        title="Aucune carte modifiée"
        description="Ouvrez une carte du jeu pour changer sa personne ou sa consigne dans cette variante."
        variant="naked"
        :actions="[{ label: 'Voir tout le jeu', color: 'neutral', variant: 'subtle', onClick: () => { show = 'all' } }]"
      />

      <DeckVariantCardSlideover
        v-model:card-id="openCardId"
        :variant-id="variant.id"
        :ids="visibleIds"
      />
    </template>

    <UModal
      :open="Boolean(nameModal)"
      :title="nameModal === 'create' ? 'Nouvelle variante' : 'Renommer la variante'"
      :description="nameModal === 'create' ? 'Elle reprend toutes les cartes du deck. Vous modifierez ensuite les cartes qui changent.' : undefined"
      :ui="{ footer: 'justify-end' }"
      @update:open="(value: boolean) => { if (!value) nameModal = null }"
    >
      <template #body>
        <form
          id="variant-name-form"
          @submit.prevent="saveName"
        >
          <UFormField label="Nom">
            <UInput
              v-model="nameDraft"
              :maxlength="VARIANT_NAME_MAX"
              placeholder="Ex. Version famille Martin"
              autofocus
              class="w-full"
            />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <UButton
          label="Annuler"
          color="neutral"
          variant="ghost"
          @click="nameModal = null"
        />
        <UButton
          type="submit"
          form="variant-name-form"
          :label="nameModal === 'create' ? 'Créer' : 'Renommer'"
          :loading="savingName"
          :disabled="!nameDraft.trim()"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="deleteOpen"
      :title="`Supprimer « ${variant?.name} » ?`"
      description="Les cartes modifiées dans cette variante seront perdues. Le deck ne change pas."
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer="{ close }">
        <UButton
          label="Annuler"
          color="neutral"
          variant="ghost"
          @click="close"
        />
        <UButton
          label="Supprimer"
          color="error"
          icon="i-lucide-trash-2"
          :loading="deleting"
          @click="confirmDelete"
        />
      </template>
    </UModal>
  </div>
</template>
