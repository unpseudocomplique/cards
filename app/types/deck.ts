import type { CardThemeId } from '~~/shared/utils/cardThemes'
import type { CardFormatId } from '~~/shared/utils/printSpec'

export type DeckType = 'classic52' | 'tarot56' | 'tarot78'
export type CardRolePromptKey = 'number' | 'ace' | 'jack' | 'knight' | 'queen' | 'king' | 'trump' | 'excuse'
export type CardSuitPromptKey = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'trumps'

export type DeckSummary = {
  id: string
  title: string
  description: string | null
  type: DeckType
  status: 'draft' | 'queued' | 'generating' | 'ready' | 'failed'
  cardCount: number
  readyCardCount: number
  createdAt: string
  updatedAt: string
  /** Up to three ready faces picked for the deck cover (list endpoint only). */
  coverUrls?: string[]
  settings?: DeckSettings
}

export type DeckCard = {
  id: string
  cardCode: string
  sourcePhotoId: string | null
  sourcePersonId: string | null
  status: 'pending' | 'queued' | 'generating' | 'ready' | 'failed'
  metadata: {
    label: string
    shortLabel: string
    suit?: string
    rank?: string
    role?: string
    sortOrder: number
    aspectRatio: '3:4' | '9:16'
    promptHint: string
    /** Format the stored face was rendered in (absent = poker). */
    format?: CardFormatId
  }
  prompt: string | null
  rawImageUrl: string | null
  finalImageUrl: string | null
  errorMessage: string | null
}

export type DeckPhoto = {
  id: string
  personId: string | null
  label: string
  url: string
  originalFilename: string | null
  size: number
  createdAt: string
}

export type DeckPerson = {
  id: string
  label: string
  /** Prompt layer applied to all of this person's cards. */
  prompt: string | null
  createdAt: string
  photos: DeckPhoto[]
}

export type DeckSettings = {
  allowPhotoReuse: boolean
  visualStyle: string
  rolePrompts?: Partial<Record<CardRolePromptKey, string>>
  suitPrompts?: Partial<Record<CardSuitPromptKey, string>>
  colorTheme?: CardThemeId
  cardBackPrompt?: string
  cardBackImageUrl?: string | null
  cardBackImageKey?: string | null
  /** Deck card format (absent on decks created before formats = poker). */
  cardFormat?: CardFormatId
  /** Format the current back was rendered in (absent = poker). */
  cardBackFormat?: CardFormatId
}

export type DeckDetails = {
  deck: DeckSummary & {
    settings: DeckSettings
  }
  cards: DeckCard[]
  persons: DeckPerson[]
  photos: DeckPhoto[]
}
