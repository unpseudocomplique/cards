<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CardRolePromptKey, DeckPerson } from '~/types/deck'
import { cardRole, roleMeta } from '~/utils/deckLabels'

const toast = useToast()
const { cards, persons, personById, assignRole } = useDeckWorkspace()

const busyRole = shallowRef<CardRolePromptKey | null>(null)

const groups = computed(() => {
  const byRole = new Map<CardRolePromptKey, typeof cards.value>()
  for (const card of cards.value) {
    const role = cardRole(card)
    byRole.set(role, [...(byRole.get(role) ?? []), card])
  }

  return [...byRole.entries()]
    .sort(([a], [b]) => roleMeta[a].order - roleMeta[b].order)
    .map(([role, list]) => {
      const people = new Map<string, DeckPerson>()
      for (const card of list) {
        const person = card.sourcePersonId ? personById.value.get(card.sourcePersonId) : null
        if (person) {
          people.set(person.id, person)
        }
      }
      return {
        role,
        label: roleMeta[role].plural,
        total: list.length,
        assigned: list.filter(card => card.sourcePersonId).length,
        people: [...people.values()]
      }
    })
})

function menuFor(role: CardRolePromptKey, label: string): DropdownMenuItem[][] {
  return [
    [{ type: 'label', label: `Toutes les cartes « ${label} »` }],
    persons.value.map(person => ({
      label: person.label,
      avatar: { src: person.photos[0]?.url, alt: person.label },
      onSelect: () => apply(role, person.id, label)
    })),
    [{ label: 'Retirer les personnes', icon: 'i-lucide-user-round-x', color: 'error' as const, onSelect: () => apply(role, null, label) }]
  ]
}

async function apply(role: CardRolePromptKey, personId: string | null, label: string) {
  busyRole.value = role
  const count = await assignRole(role, personId)
  busyRole.value = null
  if (count) {
    const person = personId ? personById.value.get(personId) : null
    toast.add({
      title: person ? `${label} → ${person.label}` : `${label} sans personne`,
      description: `${count} carte${count > 1 ? 's' : ''} mise${count > 1 ? 's' : ''} à jour.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
  }
}
</script>

<template>
  <ul class="divide-y divide-default overflow-hidden rounded-xl ring ring-default">
    <li
      v-for="group in groups"
      :key="group.role"
      class="flex items-center gap-3 bg-default px-4 py-3"
    >
      <div class="w-28 shrink-0 sm:w-36">
        <p class="font-medium text-highlighted">
          {{ group.label }}
        </p>
        <p class="text-xs text-muted tabular-nums">
          {{ group.assigned }}/{{ group.total }} attribuée{{ group.assigned > 1 ? 's' : '' }}
        </p>
      </div>

      <div class="flex min-w-0 flex-1 items-center gap-2">
        <UAvatarGroup
          v-if="group.people.length"
          :max="4"
          size="sm"
        >
          <UAvatar
            v-for="person in group.people"
            :key="person.id"
            :src="person.photos[0]?.url"
            :alt="person.label"
          />
        </UAvatarGroup>
        <span class="hidden truncate text-sm text-muted sm:inline">
          {{ group.people.length
            ? group.people.map(person => person.label).join(', ')
            : 'Personne pour l’instant' }}
        </span>
        <UProgress
          v-if="group.assigned && group.assigned < group.total"
          :model-value="group.assigned"
          :max="group.total"
          size="2xs"
          class="ml-auto hidden w-16 lg:block"
        />
      </div>

      <UDropdownMenu
        :items="menuFor(group.role, group.label)"
        :content="{ align: 'end' }"
        :disabled="!persons.length"
      >
        <UButton
          :label="group.assigned ? 'Changer' : 'Attribuer'"
          trailing-icon="i-lucide-chevron-down"
          size="sm"
          :color="group.assigned === group.total ? 'neutral' : 'primary'"
          :variant="group.assigned === group.total ? 'outline' : 'soft'"
          :loading="busyRole === group.role"
          :disabled="!persons.length"
        />
      </UDropdownMenu>
    </li>
  </ul>
</template>
