import type { CardFormatId } from '../utils/printSpec'

export type DeckTextureManifest = {
  deckId: string
  /** Card format of the deck; every face and the back share it. */
  format: CardFormatId
  /** Card width / height, to size cards on the table. */
  cardRatio: number
  backUrl: string | null
  cards: Array<{
    cardCode: string
    /** Null when the card has no face yet, or only one from a previous format. */
    faceUrl: string | null
    /** Legacy hint kept for older clients. */
    aspectRatio: '3:4' | '9:16'
  }>
}
