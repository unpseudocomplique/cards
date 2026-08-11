import type { BidState, Contract } from './bid'

export type CardId = string & { readonly __brand: 'CardId' }

export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'trumps'

export type SeatId = number

export type PlayerCount = 3 | 4 | 5

export type Phase =
  | 'Lobby'
  | 'Dealing'
  | 'Bidding'
  | 'DogEcarta'
  | 'ReadyToPlay'
  | 'Trick'
  | 'Scoring'
  | 'MatchOver'

export type EndMode = 'threshold' | 'deals'

export type SeatInfo = {
  seatId: number
  userId: string | null
  name: string
  connected: boolean
  controlledBy: 'human' | 'bot'
}

export type GameConfig = {
  hostUserId: string
  hostName?: string
  playerCount: PlayerCount
  endMode: EndMode
  endValue: number
  code?: string
}

export type GameState = {
  phase: Phase
  playerCount: PlayerCount
  endMode: EndMode
  endValue: number
  code?: string
  version: number
  dealerSeat: number
  currentSeat: number
  seats: SeatInfo[]
  hands: CardId[][]
  chien: CardId[]
  ecart: CardId[]
  bidState: BidState | null
  bid: { seat: number, contract: Contract } | null
  bidSpoken: Array<{ seat: number, bid: Contract | 'passe' }>
  partnerSeat?: number
  calledKing?: CardId
  trick: Array<{ seat: number, card: CardId }>
  pilesAttack: CardId[]
  pilesDefense: CardId[]
  scores: number[]
  dealIndex: number
  poigneeShown?: { seat: number, tier: 10 | 13 | 15 | 8 | 18 }
  chelemAnnounce?: 'announced' | 'defense'
  hostUserId: string
  /** Monotonic counter for deterministic re-deals within a match. */
  rngCounter: number
}

export type Actor = {
  userId: string
  seat?: number
}

export type ApplyError =
  | 'ILLEGAL_MOVE'
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'TABLE_FULL'
  | 'UNAUTHORIZED'
  | 'UNKNOWN_TABLE'

export type GameEvent =
  | { type: 'joined', seat: number, userId: string }
  | { type: 'botAdded', seat: number }
  | { type: 'botRemoved', seat: number }
  | { type: 'started' }
  | { type: 'dealt', dealIndex: number }
  | { type: 'redeal', reason: 'petit_sec' | 'all_pass' }
  | { type: 'bidSpoken', seat: number, bid: Contract | 'passe' }
  | { type: 'contractWon', seat: number, contract: Contract }
  | { type: 'ecartLocked', seat: number }
  | { type: 'cardPlayed', seat: number, card: CardId }
  | { type: 'trickWon', seat: number }
  | { type: 'dealScored', deltas: Record<number, number> }
  | { type: 'matchOver' }

export type ApplyResult =
  | { ok: true, state: GameState, events: GameEvent[] }
  | { ok: false, error: ApplyError, reason: string }

export type Intent =
  | { type: 'join', name: string }
  | { type: 'addBot', name?: string }
  | { type: 'removeBot', seat: number }
  | { type: 'start' }
  | { type: 'bid', bid: Contract | 'passe' }
  | { type: 'callKing', king: CardId }
  | { type: 'discard', cards: CardId[] }
  | { type: 'announcePoignee', tier: 10 | 13 | 15 | 8 | 18 }
  | { type: 'announceChelem', kind: 'announced' | 'defense' }
  | { type: 'playCard', card: CardId }
  | { type: 'leave' }

export type PublicSeatInfo = Omit<SeatInfo, 'userId'> & { userId: string | null }

export type PublicGameView = {
  phase: Phase
  version: number
  playerCount: PlayerCount
  endMode: EndMode
  endValue: number
  code?: string
  dealerSeat: number
  currentSeat: number
  seats: PublicSeatInfo[]
  handCounts: number[]
  trick: Array<{ seat: number, card: CardId }>
  chienRevealed: CardId[] | null
  ecartCount: number
  bid: { seat: number, contract: Contract } | null
  bidSpoken: Array<{ seat: number, bid: Contract | 'passe' }>
  partnerSeat?: number
  calledKing?: CardId
  scores: number[]
  dealIndex: number
  pilesAttackCount: number
  pilesDefenseCount: number
  poigneeShown?: GameState['poigneeShown']
  chelemAnnounce?: GameState['chelemAnnounce']
}

export type PrivateGameView = PublicGameView & {
  seat: number
  hand: CardId[]
  legalMoves: CardId[]
}

export interface DealResult {
  hands: CardId[][]
  chien: CardId[]
  petitSecSeats: SeatId[]
}

export const TAROT_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const
export const TAROT_RANKS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'c', 'q', 'k'] as const
