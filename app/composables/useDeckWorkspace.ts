import type { InjectionKey } from 'vue'
import type { CardRolePromptKey, DeckCard, DeckDetails, DeckPerson, DeckSettings } from '~/types/deck'
import { getCardTheme } from '~~/shared/utils/cardThemes'
import { cardFormatRatio, resolveCardImageFormat, resolveDeckCardFormat } from '~~/shared/utils/printSpec'
import { patchDeckSettings, patchDeckWithCard } from '~/utils/deckState'
import { isGeneratable } from '~/utils/deckLabels'

export type GenerationJob = {
  total: number
  completed: number
  failed: number
  currentCardId: string | null
  stopping: boolean
}

function createWorkspace(deckId: Ref<string>) {
  const requestFetch = useRequestFetch()
  const toast = useToast()

  const request = useAsyncData(
    () => `deck-${deckId.value}`,
    () => requestFetch<DeckDetails>(`/api/decks/${deckId.value}`)
  )
  const { data, status, error, refresh } = request

  const deck = computed(() => data.value?.deck ?? null)
  const cards = computed(() => data.value?.cards ?? [])
  const persons = computed(() => data.value?.persons ?? [])
  const theme = computed(() => getCardTheme(deck.value?.settings.colorTheme))
  const format = computed(() => resolveDeckCardFormat(deck.value?.settings))
  const cardRatio = computed(() => cardFormatRatio(format.value))

  /** The card keeps an image rendered in a previous format: it must be regenerated. */
  function isOutdated(card: DeckCard) {
    return Boolean(card.finalImageUrl) && resolveCardImageFormat(card.metadata).id !== format.value.id
  }

  const backOutdated = computed(() => Boolean(deck.value?.settings.cardBackImageUrl)
    && resolveDeckCardFormat({ cardFormat: deck.value?.settings.cardBackFormat }).id !== format.value.id)
  const personById = computed(() => new Map(persons.value.map(person => [person.id, person])))

  const cardCountByPerson = computed(() => {
    const counts = new Map<string, number>()
    for (const card of cards.value) {
      if (card.sourcePersonId) {
        counts.set(card.sourcePersonId, (counts.get(card.sourcePersonId) ?? 0) + 1)
      }
    }
    return counts
  })

  const stats = computed(() => {
    const list = cards.value
    return {
      total: list.length,
      ready: list.filter(card => card.status === 'ready').length,
      failed: list.filter(card => card.status === 'failed').length,
      unassigned: list.filter(card => !card.sourcePersonId).length,
      generatable: list.filter(isGeneratable).length,
      outdated: list.filter(isOutdated).length
    }
  })

  function personFor(card: DeckCard): DeckPerson | null {
    return card.sourcePersonId ? personById.value.get(card.sourcePersonId) ?? null : null
  }

  function patchCard(card: DeckCard) {
    if (data.value) {
      data.value = patchDeckWithCard(data.value, card)
    }
  }

  function patchSettings(settings: Partial<DeckSettings>) {
    if (data.value) {
      data.value = patchDeckSettings(data.value, settings)
    }
  }

  function findCard(cardId: string) {
    return cards.value.find(card => card.id === cardId) ?? null
  }

  /* ---------------------------------------------------------------- */
  /* Generation: one card at a time, survives tab switches.            */
  /* ---------------------------------------------------------------- */

  const job = shallowRef<GenerationJob | null>(null)
  const generatingIds = shallowRef(new Set<string>())

  function markGenerating(cardId: string, on: boolean) {
    const next = new Set(generatingIds.value)
    if (on) {
      next.add(cardId)
    } else {
      next.delete(cardId)
    }
    generatingIds.value = next
  }

  async function generateCard(card: DeckCard): Promise<{ ok: true } | { ok: false, message: string }> {
    markGenerating(card.id, true)
    patchCard({ ...card, status: 'generating', errorMessage: null })

    try {
      const updated = await $fetch<DeckCard>(`/api/decks/${deckId.value}/cards/${card.id}/generate`, {
        method: 'POST'
      })
      patchCard(updated)
      return { ok: true }
    } catch (err) {
      const message = getApiErrorMessage(err, 'Génération impossible.')
      patchCard(getApiErrorCard(err) ?? { ...card, status: 'failed', errorMessage: message })
      return { ok: false, message }
    } finally {
      markGenerating(card.id, false)
    }
  }

  async function generateCards(targets: DeckCard[]) {
    const queue = targets.filter(card => card.sourcePersonId)
    const skipped = targets.length - queue.length

    if (job.value) {
      toast.add({ title: 'Une génération est déjà en cours', color: 'warning', icon: 'i-lucide-hourglass' })
      return
    }

    if (!queue.length) {
      toast.add({
        title: 'Rien à générer',
        description: 'Affectez d’abord une personne aux cartes choisies.',
        color: 'warning',
        icon: 'i-lucide-user-round-x'
      })
      return
    }

    for (const card of queue) {
      patchCard({ ...card, status: 'queued', errorMessage: null })
    }

    job.value = { total: queue.length, completed: 0, failed: 0, currentCardId: null, stopping: false }
    const errors: string[] = []

    for (const card of queue) {
      if (job.value?.stopping) {
        // Put untouched cards back the way they were before being queued.
        patchCard({ ...(findCard(card.id) ?? card), status: card.status, errorMessage: card.errorMessage })
        continue
      }

      job.value = { ...job.value!, currentCardId: card.id }
      const result = await generateCard(findCard(card.id) ?? card)

      job.value = {
        ...job.value!,
        completed: job.value!.completed + 1,
        failed: job.value!.failed + (result.ok ? 0 : 1)
      }

      if (!result.ok) {
        errors.push(result.message)
      }
    }

    const finished = job.value!
    job.value = null
    // Keep the library and sidebar progress in sync.
    void refreshNuxtData('decks')

    const done = finished.completed - finished.failed
    toast.add({
      title: finished.failed ? 'Génération terminée avec des erreurs' : finished.stopping ? 'Génération interrompue' : 'Cartes générées',
      description: [
        `${done} carte${done > 1 ? 's' : ''} créée${done > 1 ? 's' : ''}`,
        finished.failed ? `${finished.failed} échec${finished.failed > 1 ? 's' : ''} — ${[...new Set(errors)][0]}` : null,
        skipped ? `${skipped} ignorée${skipped > 1 ? 's' : ''} (sans personne)` : null
      ].filter(Boolean).join(' · '),
      color: finished.failed ? 'warning' : 'success',
      icon: finished.failed ? 'i-lucide-triangle-alert' : 'i-lucide-sparkles'
    })
  }

  function stopGeneration() {
    if (job.value) {
      job.value = { ...job.value, stopping: true }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Assignments                                                        */
  /* ---------------------------------------------------------------- */

  async function assignCards(targets: DeckCard[], personId: string | null) {
    const person = personId ? personById.value.get(personId) ?? null : null
    let updated = 0

    for (const card of targets) {
      try {
        await $fetch(`/api/decks/${deckId.value}/assignments`, {
          method: 'PATCH',
          body: { scope: 'card', cardId: card.id, personId }
        })
        patchCard({
          ...card,
          sourcePersonId: personId,
          sourcePhotoId: person?.photos[0]?.id ?? null
        })
        updated += 1
      } catch (err) {
        toast.add({
          title: `Affectation impossible : ${card.metadata.label}`,
          description: getApiErrorMessage(err),
          color: 'error',
          icon: 'i-lucide-circle-alert'
        })
      }
    }

    return updated
  }

  async function assignRole(role: CardRolePromptKey, personId: string | null) {
    try {
      const response = await $fetch<{ assignedCount: number }>(`/api/decks/${deckId.value}/assignments`, {
        method: 'PATCH',
        body: { scope: 'role', role, personId }
      })
      await refresh()
      return response.assignedCount
    } catch (err) {
      toast.add({
        title: 'Affectation impossible',
        description: getApiErrorMessage(err),
        color: 'error',
        icon: 'i-lucide-circle-alert'
      })
      return 0
    }
  }

  return {
    deckId,
    request,
    data,
    status,
    error,
    refresh,
    deck,
    cards,
    persons,
    theme,
    format,
    cardRatio,
    isOutdated,
    backOutdated,
    stats,
    personById,
    cardCountByPerson,
    personFor,
    findCard,
    patchCard,
    patchSettings,
    job: readonly(job),
    generatingIds: readonly(generatingIds),
    generateCard,
    generateCards,
    stopGeneration,
    assignCards,
    assignRole
  }
}

export type DeckWorkspace = ReturnType<typeof createWorkspace>

const DeckWorkspaceKey: InjectionKey<DeckWorkspace> = Symbol('deck-workspace')

/** Called once by the deck page: loads the deck and shares it with every tab. */
export function provideDeckWorkspace(deckId: Ref<string>) {
  const workspace = createWorkspace(deckId)
  provide(DeckWorkspaceKey, workspace)
  return workspace
}

export function useDeckWorkspace() {
  const workspace = inject(DeckWorkspaceKey, null)
  if (!workspace) {
    throw new Error('useDeckWorkspace() must be used inside the deck page.')
  }
  return workspace
}
