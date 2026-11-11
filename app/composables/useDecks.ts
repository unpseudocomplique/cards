import type { DeckSummary } from '~/types/deck'

/** The signed-in user's decks, shared by the sidebar, the library and the play setup. */
export function useDecks() {
  const requestFetch = useRequestFetch()

  return useAsyncData(
    'decks',
    () => requestFetch<DeckSummary[]>('/api/decks'),
    { default: () => [] as DeckSummary[] }
  )
}
