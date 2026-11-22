import type { CardId } from '~~/shared/tarot'

export type CardZoom = {
  card: CardId
  faceUrl: string | null
  /** 'hold': shown while the finger stays down; 'tap': until the next tap. */
  mode: 'hold' | 'tap'
}

/** One big card shown over the table, to look at a card closely. */
export function useCardZoom() {
  const zoom = useState<CardZoom | null>('play-card-zoom', () => null)

  function show(card: CardId, faceUrl: string | null, mode: CardZoom['mode'] = 'tap') {
    zoom.value = { card, faceUrl, mode }
  }

  function close() {
    zoom.value = null
  }

  return { zoom, show, close }
}
