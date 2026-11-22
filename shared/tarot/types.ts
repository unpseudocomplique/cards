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
  deckId: string
}

export type GameState = {
  phase: Phase
  playerCount: PlayerCount
  endMode: EndMode
  endValue: number
  code?: string
  deckId: string
  version: number
  dealerSeat: number
  currentSeat: number
  seats: SeatInfo[]
  hands: CardId[][]
  chien: CardId[]
  /**
   * Prise / garde: the dog cards turned face up for everyone until the taker
   * discards (5 players: once the king is called). Never set for garde sans/contre.
   */
  dogShown?: CardId[]
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
  /** Poignées shown this deal (several players may show one), with the trumps shown. */
  poignees?: PoigneeShown[]
  /** Trumps the taker had to put in the écart, shown to the defence (FFT). */
  ecartShownTrumps?: CardId[]
  /** Camp that kept its Excuse after a lost trick and owes a low card in exchange. */
  excuseOwedBy?: 'attack' | 'defense'
  /** Trick (1-based) in which the Petit fell, and the camp that won it. */
  petitTrick?: { number: number, camp: 'attack' | 'defense' }
  chelemAnnounce?: 'announced' | 'defense'
  /** Tricks won by attack / defense camps this deal (for chelem). */
  attackTricks: number
  defenseTricks: number
  /** Face-down won-trick stacks per seat (visual + bookkeeping). */
  tricksWonBySeat: number[]
  /** Last completed trick (kept briefly for client FX / collect anim). */
  lastTrick: Array<{ seat: number, card: CardId }> | null
  lastTrickWinnerSeat: number | null
  /** Petit won on the last trick of the deal. */
  petitAuBoutCamp?: 'attack' | 'defense'
  /** Last deal point deltas while phase === Scoring. */
  lastDeltas?: Record<number, number>
  /** After Scoring, continue ends the match instead of redealing. */
  matchShouldEnd?: boolean
  hostUserId: string
  /** Monotonic counter for deterministic re-deals within a match. */
  rngCounter: number
}

export type PoigneeTier = 10 | 13 | 15 | 8 | 18

export type PoigneeShown = { seat: number, tier: PoigneeTier, cards: CardId[] }

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
  | { type: 'announcePoignee', tier: PoigneeTier }
  | { type: 'announceChelem', kind: 'announced' | 'defense' }
  | { type: 'playCard', card: CardId }
  | { type: 'continue' }
  | { type: 'leave' }

export type PublicSeatInfo = Omit<SeatInfo, 'userId'> & { userId: string | null }

export type PublicGameView = {
  phase: Phase
  version: number
  playerCount: PlayerCount
  endMode: EndMode
  endValue: number
  code?: string
  deckId: string
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
  tricksWonBySeat: number[]
  lastTrick: Array<{ seat: number, card: CardId }> | null
  lastTrickWinnerSeat: number | null
  poignees?: PoigneeShown[]
  ecartShownTrumps?: CardId[]
  chelemAnnounce?: GameState['chelemAnnounce']
  lastDeltas?: Record<number, number>
  matchShouldEnd?: boolean
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
