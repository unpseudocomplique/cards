import type { DeckCard, DeckVariant, DeckVariantCard } from '~/types/deck'
import { resolvePrintFaces } from '~~/shared/utils/deckVariants'

/**
 * The card as it appears in a variant: the deck card, with the variant's
 * person, prompt and face when the variant overrides it.
 */
export function variantCardView(base: DeckCard, override?: DeckVariantCard | null): DeckCard {
  if (!override) {
    return base
  }

  const { design: _design, ...metadata } = base.metadata

  return {
    ...base,
    sourcePersonId: override.sourcePersonId,
    sourcePhotoId: override.sourcePhotoId,
    prompt: override.prompt ?? base.prompt,
    status: override.status,
    rawImageUrl: override.rawImageUrl,
    finalImageUrl: override.finalImageUrl,
    errorMessage: override.errorMessage,
    metadata: { ...metadata, format: override.metadata.format }
  }
}

/** Print variants of the current deck: data and actions, shared by every view. */
export function useDeckVariants() {
  const workspace = useDeckWorkspace()
  const { deckId, cards, variants, format, patchVariants } = workspace
  const toast = useToast()

  // Shared between the variants page and its slideover.
  const generating = useState(`deck-variant-generating-${deckId.value}`, () => [] as string[])

  function generatingKey(variantId: string, cardId: string) {
    return `${variantId}:${cardId}`
  }

  function isGenerating(variantId: string, cardId: string) {
    return generating.value.includes(generatingKey(variantId, cardId))
  }

  function findVariant(variantId: string | null | undefined) {
    return variantId ? variants.value.find(variant => variant.id === variantId) ?? null : null
  }

  function overrideFor(variant: DeckVariant | null, cardId: string) {
    return variant?.cards.find(card => card.baseCardId === cardId) ?? null
  }

  /** What printing this variant would give right now. */
  function printStatus(variant: DeckVariant | null) {
    const result = resolvePrintFaces(cards.value, variant?.cards ?? [], format.value.id)
    return {
      cardCount: result.faces.length,
      overridden: variant?.cards.length ?? 0,
      missing: result.missing.length,
      skipped: result.skipped.length
    }
  }

  function setOverride(variantId: string, card: DeckVariantCard) {
    patchVariants(list => list.map(variant => variant.id !== variantId
      ? variant
      : {
          ...variant,
          cards: variant.cards.some(existing => existing.baseCardId === card.baseCardId)
            ? variant.cards.map(existing => existing.baseCardId === card.baseCardId ? card : existing)
            : [...variant.cards, card]
        }))
  }

  async function createVariant(name: string) {
    try {
      const variant = await $fetch<DeckVariant>(`/api/decks/${deckId.value}/variants`, {
        method: 'POST',
        body: { name }
      })
      patchVariants(list => [...list, variant])
      return variant
    } catch (err) {
      toast.add({ title: 'Création impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
      return null
    }
  }

  async function renameVariant(variantId: string, name: string) {
    try {
      const result = await $fetch<{ name: string }>(`/api/decks/${deckId.value}/variants/${variantId}`, {
        method: 'PATCH',
        body: { name }
      })
      patchVariants(list => list.map(variant => variant.id === variantId ? { ...variant, name: result.name } : variant))
      return true
    } catch (err) {
      toast.add({ title: 'Renommage impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
      return false
    }
  }

  async function deleteVariant(variantId: string) {
    try {
      await $fetch(`/api/decks/${deckId.value}/variants/${variantId}`, { method: 'DELETE' })
      patchVariants(list => list.filter(variant => variant.id !== variantId))
      return true
    } catch (err) {
      toast.add({ title: 'Suppression impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
      return false
    }
  }

  /** Create or update the override of a card (person and/or prompt). */
  async function overrideCard(variantId: string, cardId: string, body: { personId?: string | null, prompt?: string | null }) {
    try {
      const card = await $fetch<DeckVariantCard>(`/api/decks/${deckId.value}/variants/${variantId}/cards/${cardId}`, {
        method: 'PUT',
        body
      })
      setOverride(variantId, card)
      return card
    } catch (err) {
      toast.add({ title: 'Modification impossible', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
      return null
    }
  }

  /** Drop the override: the card follows the deck again. */
  async function resetCard(variantId: string, cardId: string) {
    try {
      await $fetch(`/api/decks/${deckId.value}/variants/${variantId}/cards/${cardId}`, { method: 'DELETE' })
      patchVariants(list => list.map(variant => variant.id !== variantId
        ? variant
        : { ...variant, cards: variant.cards.filter(card => card.baseCardId !== cardId) }))
      return true
    } catch (err) {
      toast.add({ title: 'Impossible de revenir à la carte du deck', description: getApiErrorMessage(err), color: 'error', icon: 'i-lucide-circle-alert' })
      return false
    }
  }

  async function generateVariantCard(variantId: string, cardId: string): Promise<{ ok: true } | { ok: false, message: string }> {
    const key = generatingKey(variantId, cardId)
    const override = overrideFor(findVariant(variantId), cardId)

    if (!override || generating.value.includes(key)) {
      return { ok: false, message: 'Rien à générer' }
    }

    generating.value = [...generating.value, key]
    setOverride(variantId, { ...override, status: 'generating', errorMessage: null })

    try {
      const updated = await $fetch<DeckVariantCard>(`/api/decks/${deckId.value}/variants/${variantId}/cards/${cardId}/generate`, {
        method: 'POST'
      })
      setOverride(variantId, updated)
      return { ok: true }
    } catch (err) {
      const message = getApiErrorMessage(err, 'Génération impossible.')
      setOverride(variantId, (getApiErrorCard(err) as DeckVariantCard | null) ?? { ...override, status: 'failed', errorMessage: message })
      return { ok: false, message }
    } finally {
      generating.value = generating.value.filter(entry => entry !== key)
    }
  }

  /** Generate, one after the other, the overridden cards that have no face yet. */
  async function generatePending(variantId: string) {
    const variant = findVariant(variantId)
    const targets = (variant?.cards ?? []).filter(card => card.sourcePersonId
      && card.status !== 'ready'
      && !isGenerating(variantId, card.baseCardId))
    let failed = 0
    let lastError = ''

    for (const card of targets) {
      const result = await generateVariantCard(variantId, card.baseCardId)
      if (!result.ok) {
        failed += 1
        lastError = result.message
      }
    }

    const done = targets.length - failed
    toast.add({
      title: failed ? 'Génération terminée avec des erreurs' : 'Cartes de la variante générées',
      description: [
        `${done} carte${done > 1 ? 's' : ''} créée${done > 1 ? 's' : ''}`,
        failed ? `${failed} échec${failed > 1 ? 's' : ''} — ${lastError}` : null
      ].filter(Boolean).join(' · '),
      color: failed ? 'warning' : 'success',
      icon: failed ? 'i-lucide-triangle-alert' : 'i-lucide-sparkles'
    })
  }

  return {
    ...workspace,
    variants,
    findVariant,
    overrideFor,
    printStatus,
    isGenerating,
    createVariant,
    renameVariant,
    deleteVariant,
    overrideCard,
    resetCard,
    generateVariantCard,
    generatePending
  }
}
