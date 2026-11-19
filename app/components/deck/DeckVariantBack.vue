<script setup lang="ts">
import { cardFormatRatio } from '~~/shared/utils/printSpec'

const props = defineProps<{
  variantId: string
}>()

const { deckId, deck, theme, format, backOutdated, findVariant, backOutdatedFor, isGeneratingBack, generateVariantBack, resetVariantBack } = useDeckVariants()

const variant = computed(() => findVariant(props.variantId))
const own = computed(() => variant.value?.back ?? null)
const deckBackUrl = computed(() => backOutdated.value ? null : deck.value?.settings.cardBackImageUrl ?? null)
const imageUrl = computed(() => own.value?.imageUrl ?? deckBackUrl.value)
const outdated = computed(() => backOutdatedFor(variant.value))
const generating = computed(() => isGeneratingBack(props.variantId))

const editing = shallowRef(false)
const prompt = shallowRef('')
const resetting = shallowRef(false)

watch(() => props.variantId, () => {
  editing.value = false
}, { immediate: true })

function startEditing() {
  prompt.value = own.value?.prompt ?? ''
  editing.value = true
}

async function generate() {
  if (await generateVariantBack(props.variantId, prompt.value.trim() || null)) {
    editing.value = false
  }
}

async function reset() {
  resetting.value = true
  await resetVariantBack(props.variantId)
  resetting.value = false
}
</script>

<template>
  <div class="flex flex-col gap-4 rounded-xl p-4 ring ring-default sm:flex-row sm:items-start">
    <div class="relative w-20 shrink-0 self-center sm:self-start">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        alt="Dos de la variante"
        class="w-full rounded-[5%] object-cover shadow"
        :class="generating || outdated ? 'opacity-50' : ''"
        :style="{ aspectRatio: String(cardFormatRatio(format)) }"
      >
      <CardArt
        v-else
        :theme="theme"
        :format="format.id"
        glyph="?"
        class="shadow"
      />
      <div
        v-if="generating"
        class="absolute inset-0 grid place-items-center"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin text-primary"
        />
      </div>
    </div>

    <div class="min-w-0 flex-1 space-y-3">
      <div>
        <p class="flex flex-wrap items-center gap-2 text-sm font-medium text-highlighted">
          Dos
          <UBadge
            v-if="own"
            label="Propre à la variante"
            icon="i-lucide-pencil"
            size="sm"
            variant="subtle"
          />
          <UBadge
            v-else
            label="Celui du deck"
            icon="i-lucide-link"
            size="sm"
            color="neutral"
            variant="subtle"
          />
          <UBadge
            v-if="outdated"
            label="Ancien format"
            size="sm"
            color="warning"
            variant="subtle"
          />
        </p>
        <p class="mt-0.5 text-sm text-muted">
          <template v-if="own">
            Imprimé derrière toutes les cartes de cette variante, avec les couleurs du thème.
          </template>
          <template v-else>
            La variante utilise le dos du deck et suit ses changements.
            <ULink
              v-if="!deckBackUrl"
              :to="`/decks/${deckId}/impression`"
              class="text-primary"
            >
              Le deck n’a pas encore de dos.
            </ULink>
          </template>
        </p>
      </div>

      <div
        v-if="editing"
        class="space-y-2"
      >
        <UTextarea
          v-model="prompt"
          :rows="2"
          autoresize
          :maxlength="1600"
          placeholder="Motif du dos : rosace, initiales entrelacées, fleurs de lys…"
          class="w-full"
        />
        <div class="flex flex-wrap gap-2">
          <UButton
            :label="own ? 'Régénérer le dos' : 'Générer le dos'"
            icon="i-lucide-sparkles"
            size="sm"
            :loading="generating"
            @click="generate"
          />
          <UButton
            label="Annuler"
            size="sm"
            color="neutral"
            variant="ghost"
            :disabled="generating"
            @click="editing = false"
          />
        </div>
      </div>
      <div
        v-else
        class="flex flex-wrap gap-2"
      >
        <UButton
          :label="own ? 'Changer le dos' : 'Un dos différent pour cette variante'"
          icon="i-lucide-palette"
          size="sm"
          color="neutral"
          variant="outline"
          :loading="generating"
          @click="startEditing"
        />
        <UButton
          v-if="own"
          label="Revenir au dos du deck"
          icon="i-lucide-undo-2"
          size="sm"
          color="neutral"
          variant="ghost"
          :loading="resetting"
          :disabled="generating"
          @click="reset"
        />
      </div>
    </div>
  </div>
</template>
