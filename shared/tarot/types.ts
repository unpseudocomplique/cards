import type { BidState, Contract } from './bid'
import type { DealBreakdown } from './score'

export type CardId = string & { readonly __brand: 'CardId' }

export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'trumps'

export type SeatId = number

export type PlayerCount = 3 | 4 | 5

export type Phase =
  | 'Lobby'
  | 'Dealing'
  | 'Cutting'
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
  /** How well the bot plays this seat (bots and seats taken over by a bot). */
  botLevel?: BotLevel
  /** Account photo of a person (absent for bots). */
  picture?: string | null
  /** Salon character a bot plays as (portrait + name), see shared/play/salonCharacters. */
  character?: string
}

export type BotLevel = 'facile' | 'moyen' | 'difficile'

export type GameConfig = {
  hostUserId: string
  hostName?: string
  hostPicture?: string | null
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
  /** Each seat's hand as dealt, before the dog (secret: for the statistics only). */
  dealtHands?: CardId[][]
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
  /** Prise / garde: the dog everyone saw, kept for the whole deal (bots remember it). */
  dogSeen?: CardId[]
  /** Completed tricks of this deal in play order (public: everyone saw them). */
  playedTricks?: Array<Array<{ seat: number, card: CardId }>>
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
  /** Card points each seat collected in its won tricks this deal (public: tricks are played face up). */
  pointsWonBySeat?: number[]
  /** Bouts each seat collected in its won tricks this deal. */
  oudlersWonBySeat?: number[]
  /** Every step of the last deal's score, while phase === Scoring. */
  lastDeal?: DealBreakdown
  /** One line per finished deal of the match, for the end-of-match podium. */
  dealHistory?: DealRecord[]
  /** Someone asked the table to wait on the deal summary: no automatic next deal. */
  scoringHeld?: boolean
  /** Server time (ms) when the table moves on by itself from the deal summary. */
  autoContinueAt?: number
  /** Last completed trick (kept briefly for client FX / collect anim). */
  lastTrick: Array<{ seat: number, card: CardId }> | null
  lastTrickWinnerSeat: number | null
  /** Petit won on the last trick of the deal. */
  petitAuBoutCamp?: 'attack' | 'defense'
  /** Last deal point deltas while phase === Scoring. */
  lastDeltas?: Record<number, number>
  /** After Scoring, continue ends the match instead of redealing. */
  matchShouldEnd?: boolean
  /**
   * The face-down pack waiting to be cut and dealt (index 0 = top card).
   * Secret: never sent to any client.
   */
  deck?: CardId[]
  /** How the pack was put together: shuffled (first deal, petit sec) or the previous deal gathered as is. */
  deckSource?: DeckSource
  /** Why the pack is being cut again without a played deal. */
  redealReason?: 'petit_sec' | 'all_pass'
  /** The cut of this deal: who cut and how many cards they lifted. */
  lastCut?: { seat: number, at: number }
  hostUserId: string
  /** Monotonic counter for deterministic re-deals within a match. */
  rngCounter: number
}

export type DeckSource = 'shuffled' | 'gathered'

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
  | { type: 'cut', seat: number, at: number }
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
  | { type: 'join', name: string, picture?: string | null }
  | { type: 'addBot', name?: string, level?: BotLevel }
  | { type: 'setBotLevel', seat: number, level: BotLevel }
  | { type: 'removeBot', seat: number }
  | { type: 'start' }
  | { type: 'cut', at: number }
  | { type: 'bid', bid: Contract | 'passe' }
  | { type: 'callKing', king: CardId }
  | { type: 'discard', cards: CardId[] }
  | { type: 'announcePoignee', tier: PoigneeTier }
  | { type: 'announceChelem', kind: 'announced' | 'defense' }
  | { type: 'playCard', card: CardId }
  | { type: 'continue' }
  | { type: 'holdScoring' }
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
  pointsWonBySeat?: number[]
  oudlersWonBySeat?: number[]
  lastDeal?: DealBreakdown
  dealHistory?: DealRecord[]
  scoringHeld?: boolean
  autoContinueAt?: number
  lastTrick: Array<{ seat: number, card: CardId }> | null
  lastTrickWinnerSeat: number | null
  poignees?: PoigneeShown[]
  ecartShownTrumps?: CardId[]
  chelemAnnounce?: GameState['chelemAnnounce']
  lastDeltas?: Record<number, number>
  matchShouldEnd?: boolean
  /** Cutting: cards in the face-down pack (the order stays secret). */
  deckCount?: number
  deckSource?: DeckSource
  redealReason?: GameState['redealReason']
  lastCut?: { seat: number, at: number }
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

export type DealRecord = {
  takerSeat: number
  partnerSeat?: number
  contract: Contract
  success: boolean
  diff: number
  deltas: Record<number, number>
  tricksWonBySeat: number[]
  petitAuBoutCamp?: 'attack' | 'defense'
  chelem?: boolean
}
