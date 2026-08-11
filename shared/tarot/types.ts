export type CardId = string & { readonly __brand: 'CardId' }

export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'trumps'

export type SeatId = number

export type PlayerCount = 3 | 4 | 5

export interface DealResult {
  hands: CardId[][]
  chien: CardId[]
  petitSecSeats: SeatId[]
}

export const TAROT_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const
export const TAROT_RANKS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'c', 'q', 'k'] as const
