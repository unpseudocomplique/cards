export type DeckType = 'classic52' | 'tarot56' | 'tarot78'

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
}

export type DeckCard = {
  id: string
  cardCode: string
  sourcePhotoId: string | null
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
  }
  prompt: string | null
  rawImageUrl: string | null
  finalImageUrl: string | null
  errorMessage: string | null
}

export type DeckPhoto = {
  id: string
  label: string
  url: string
  originalFilename: string | null
  size: number
  createdAt: string
}

export type DeckDetails = {
  deck: DeckSummary & {
    settings: {
      allowPhotoReuse: boolean
      visualStyle: string
      cardBackPrompt?: string
    }
  }
  cards: DeckCard[]
  photos: DeckPhoto[]
}
