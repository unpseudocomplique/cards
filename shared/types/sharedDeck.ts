import type { CardThemeId } from '../utils/cardThemes'
import type { CardFormatId } from '../utils/printSpec'

/** Read-only deck served by /api/share/[token] to people without an account. */
export type SharedDeck = {
  title: string
  description: string | null
  type: 'classic52' | 'tarot56' | 'tarot78'
  ownerName: string
  cardCount: number
  colorTheme: CardThemeId | null
  cardFormat: CardFormatId | null
  backImageUrl: string | null
  cards: SharedDeckCard[]
  /** Print variants of the deck, each a complete deck with its name. */
  variants: SharedDeckVariant[]
}

export type SharedDeckVariant = {
  key: number
  name: string
  /** Own back, or the deck back. */
  backImageUrl: string | null
  cards: SharedDeckCard[]
}

export type SharedDeckCard = {
  key: number
  label: string
  shortLabel: string
  suit: string | null
  role: string | null
  imageUrl: string
  /** Card changed in this variant (variants only). */
  changed?: boolean
}

/** Answer of POST /api/share/[token]/save. */
export type SavedSharedDeck = {
  deckId: string
  /** false when the visitor already had this copy (or owns the deck). */
  created: boolean
}
