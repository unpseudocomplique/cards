<script setup lang="ts">
import type { DeckPerson } from '~/types/deck'

const { deckId, deck, persons, cardCountByPerson, stats, refresh } = useDeckWorkspace()

const cardFilters = useDeckCardFilters(deckId)

function showUnassigned() {
  cardFilters.value = { ...emptyCardFilters(), status: 'unassigned' }
  return navigateTo(`/decks/${deckId.value}`)
}

const uploadOpen = shallowRef(false)
const uploadTarget = shallowRef<DeckPerson | null>(null)

function addPerson() {
  uploadTarget.value = null
  uploadOpen.value = true
}

function addPhotos(person: DeckPerson) {
  uploadTarget.value = person
  uploadOpen.value = true
}

/* Editor: keep the id, read the person fresh from the workspace after each refresh. */
const editingId = shallowRef<string | null>(null)
const editing = computed(() => persons.value.find(person => person.id === editingId.value) ?? null)
const editOpen = computed({
  get: () => Boolean(editing.value),
  set: (value: boolean) => {
    if (!value) {
      editingId.value = null
    }
  }
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-10">
    <section>
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-highlighted">
            Les personnes
          </h2>
          <p class="mt-1 max-w-prose text-sm text-muted">
            Jusqu’à six photos par personne. Variez les angles et les expressions, l’IA s’en sert comme référence.
          </p>
        </div>
        <UButton
          v-if="persons.length"
          label="Ajouter une personne"
          icon="i-lucide-user-round-plus"
          @click="addPerson"
        />
      </div>

      <UEmpty
        v-if="!persons.length"
        icon="i-lucide-users-round"
        title="Qui sera sur les cartes ?"
        description="Ajoutez une première personne avec quelques photos de son visage."
        :actions="[{ label: 'Ajouter une personne', icon: 'i-lucide-user-round-plus', onClick: addPerson }]"
        variant="subtle"
      />

      <div
        v-else
        class="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4"
      >
        <DeckPersonCard
          v-for="person in persons"
          :key="person.id"
          :person="person"
          :card-count="cardCountByPerson.get(person.id) ?? 0"
          @edit="editingId = person.id"
          @add-photos="addPhotos(person)"
        />
        <button
          type="button"
          class="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-accented text-muted transition hover:border-primary hover:bg-primary/5 hover:text-primary"
          @click="addPerson"
        >
          <UIcon
            name="i-lucide-user-round-plus"
            class="size-6"
          />
          <span class="text-sm font-medium">Ajouter une personne</span>
        </button>
      </div>
    </section>

    <section
      id="repartition"
      class="scroll-mt-6"
    >
      <div class="mb-4">
        <h2 class="text-lg font-semibold text-highlighted">
          Répartition par groupe
        </h2>
        <p class="mt-1 max-w-prose text-sm text-muted">
          Attribuez une personne à tout un groupe d’un coup. Pour une carte précise, ouvrez-la depuis l’onglet Cartes.
        </p>
      </div>

      <UAlert
        v-if="!deck?.settings.allowPhotoReuse"
        class="mb-4"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="Une personne par carte"
        description="Ce deck n’autorise pas la réutilisation d’une même personne sur plusieurs cartes."
      />

      <DeckRoleAssignment />

      <p
        v-if="stats.unassigned"
        class="mt-3 text-sm text-muted"
      >
        {{ stats.unassigned }} carte{{ stats.unassigned > 1 ? 's' : '' }} sans personne.
        <UButton
          label="Les voir"
          color="primary"
          variant="link"
          class="p-0"
          @click="showUnassigned"
        />
      </p>
    </section>

    <DeckPersonSlideover
      v-model:open="editOpen"
      :person="editing"
      @add-photos="addPhotos"
    />

    <DeckPhotoUploadModal
      v-model:open="uploadOpen"
      :deck-id="deckId"
      :person="uploadTarget"
      @uploaded="refresh()"
    />
  </div>
</template>
