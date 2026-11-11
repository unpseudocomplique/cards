import type { CardRolePromptKey, CardSuitPromptKey } from '~/types/deck'

export type CardStatusFilter = 'all' | 'todo' | 'ready' | 'failed' | 'unassigned' | 'outdated'

export type DeckCardFilters = {
  status: CardStatusFilter
  suit: 'all' | CardSuitPromptKey
  role: 'all' | 'face' | CardRolePromptKey
  query: string
}

export function emptyCardFilters(): DeckCardFilters {
  return { status: 'all', suit: 'all', role: 'all', query: '' }
}

/** Card grid filters, kept per deck so they survive tab switches. */
export function useDeckCardFilters(deckId: MaybeRefOrGetter<string>) {
  return useState<DeckCardFilters>(`deck-filters-${toValue(deckId)}`, emptyCardFilters)
}
