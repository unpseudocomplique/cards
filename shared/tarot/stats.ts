import type { Contract } from './bid'
import { handPoints } from './bot/bidding'
import { botSuit, isRealTrump, PLAIN_SUITS } from './bot/cards'
import { isOudler } from './deck'
import { poigneeTiers } from './announces'
import type { CardId, GameState, PlayerCount } from './types'

/**
 * What the statistics keep of a finished deal: who took what with which hand,
 * how it ended, and every seat's hand as dealt. Built from the Scoring state
 * on the server and stored as is (see server/utils/tarotStatsRecorder.ts).
 */

export type HandProfile = {
  /** Real trumps (the Excuse is not one). */
  trumps: number
  /** Petit, 21 and Excuse. */
  bouts: number
  kings: number
  queens: number
  /** Classic club point count of the hand (see bot/bidding.ts). */
  points: number
  longestSuit: number
  voids: number
  singletons: number
  petit: boolean
  vingtEtUn: boolean
  excuse: boolean
}

export type DealRole = 'taker' | 'partner' | 'defender'

export type ChelemOutcome = 'announced_made' | 'unannounced_made' | 'announced_failed' | 'defense'

export type DealSeatStats = {
  seat: number
  /** Account id; null for bots. */
  userId: string | null
  name: string
  isBot: boolean
  botLevel?: string
  /** A bot played this seat for its absent owner at the end of the deal. */
  autopilot?: boolean
  role: DealRole
  /** 1 = first to speak (dealer's right), playerCount = dealer. */
  position: number
  /** What this seat said at the auction. */
  bid: Contract | 'passe' | null
  /** Its camp won the deal. */
  won: boolean
  delta: number
  hand: HandProfile
  tricksWon: number
  cardPoints: number
  poignee?: 'simple' | 'double' | 'triple'
  /** Played the Petit in the last trick and its camp won it. */
  petitAuBout?: boolean
  /** Played the Petit and the other camp took it. */
  petitLost?: boolean
}

export type DealStatsRecord = {
  version: 1
  dealIndex: number
  playerCount: PlayerCount
  dealerSeat: number
  contract: Contract
  takerSeat: number
  partnerSeat?: number
  calledKing?: CardId
  /** 5 players: the taker called a king they held (or that was in the dog). */
  calledSelf?: boolean
  success: boolean
  diff: number
  points: number
  required: number
  oudlers: number
  multiplier: number
  contractPart: number
  poigneePart: number
  petitPart: number
  chelemPart: number
  petitAuBoutCamp?: 'attack' | 'defense'
  chelem?: ChelemOutcome
  /** Someone spoke before the taker's winning bid. */
  overcall: boolean
  /** The taker's hand once the dog is added (prise / garde). */
  takerHandWithDog?: HandProfile
  seats: DealSeatStats[]
}

export function isBotUserId(userId: string | null | undefined): boolean {
  return !userId || userId.startsWith('bot:')
}

export function analyzeHand(hand: CardId[]): HandProfile {
  const suitLengths = PLAIN_SUITS.map(suit => hand.filter(card => botSuit(card) === suit).length)
  return {
    trumps: hand.filter(isRealTrump).length,
    bouts: hand.filter(isOudler).length,
    kings: hand.filter(card => card.endsWith('-k')).length,
    queens: hand.filter(card => card.endsWith('-q')).length,
    points: handPoints(hand),
    longestSuit: Math.max(0, ...suitLengths),
    voids: suitLengths.filter(length => length === 0).length,
    singletons: suitLengths.filter(length => length === 1).length,
    petit: hand.includes('trump-1' as CardId),
    vingtEtUn: hand.includes('trump-21' as CardId),
    excuse: hand.includes('excuse' as CardId)
  }
}

function chelemOutcome(state: GameState, chelemPart: number): ChelemOutcome | undefined {
  if (chelemPart === 400) {
    return 'announced_made'
  }
  if (chelemPart === 200) {
    return 'unannounced_made'
  }
  if (chelemPart === -200) {
    return 'announced_failed'
  }
  if (state.attackTricks === 0 && state.defenseTricks > 0) {
    return 'defense'
  }
  return undefined
}

function poigneeLevel(playerCount: PlayerCount, tier: number): DealSeatStats['poignee'] {
  const index = poigneeTiers(playerCount).indexOf(tier as 8 | 10 | 13 | 15 | 18)
  return index === 0 ? 'simple' : index === 1 ? 'double' : index === 2 ? 'triple' : undefined
}

/** Build the record of the deal just scored. Null when the state is not a scored deal. */
export function extractDealStats(state: GameState): DealStatsRecord | null {
  const breakdown = state.lastDeal
  if (state.phase !== 'Scoring' || !breakdown || !state.bid) {
    return null
  }
  const playerCount = state.playerCount
  const takerSeat = breakdown.takerSeat
  const partnerSeat = breakdown.partnerSeat
  const attack = (seat: number) => seat === takerSeat || (partnerSeat !== undefined && seat === partnerSeat)

  const spoken = state.bidSpoken ?? []
  const bidOf = (seat: number) => spoken.find(entry => entry.seat === seat)?.bid ?? null
  const takerBidIndex = spoken.findIndex(entry => entry.seat === takerSeat && entry.bid !== 'passe')
  const overcall = spoken.slice(0, Math.max(0, takerBidIndex)).some(entry => entry.bid !== 'passe')

  // Who played the Petit, and in which trick.
  const tricks = state.playedTricks ?? []
  let petitSeat: number | null = null
  let petitTrickIndex = -1
  tricks.forEach((trick, index) => {
    const entry = trick.find(item => item.card === 'trump-1')
    if (entry) {
      petitSeat = entry.seat
      petitTrickIndex = index
    }
  })
  const petitTakenByOtherCamp = petitSeat !== null && state.petitTrick
    ? (state.petitTrick.camp === 'attack') !== attack(petitSeat)
    : false
  const petitAuBoutSeat = state.petitAuBoutCamp && petitSeat !== null
    && (state.petitAuBoutCamp === 'attack') === attack(petitSeat)
    && petitTrickIndex >= tricks.length - 2
    ? petitSeat
    : null

  const dealt = state.dealtHands ?? []
  const dog = state.dogSeen ?? []

  const seats: DealSeatStats[] = state.seats.slice(0, playerCount).map((info, seat) => {
    const role: DealRole = seat === takerSeat ? 'taker' : partnerSeat !== undefined && seat === partnerSeat ? 'partner' : 'defender'
    const isBot = isBotUserId(info.userId)
    const poignee = (state.poignees ?? []).find(entry => entry.seat === seat)
    const entry: DealSeatStats = {
      seat,
      userId: isBot ? null : info.userId,
      name: info.name,
      isBot,
      role,
      position: ((seat - state.dealerSeat - 1 + playerCount) % playerCount) + 1,
      bid: bidOf(seat),
      won: attack(seat) === breakdown.success,
      delta: breakdown.deltas[seat] ?? 0,
      hand: analyzeHand(dealt[seat] ?? []),
      tricksWon: state.tricksWonBySeat[seat] ?? 0,
      cardPoints: state.pointsWonBySeat?.[seat] ?? 0
    }
    if (isBot && info.botLevel) {
      entry.botLevel = info.botLevel
    }
    if (!isBot && info.controlledBy === 'bot') {
      entry.autopilot = true
    }
    if (poignee) {
      entry.poignee = poigneeLevel(playerCount, poignee.tier)
    }
    if (petitAuBoutSeat === seat) {
      entry.petitAuBout = true
    }
    if (petitSeat === seat && petitTakenByOtherCamp) {
      entry.petitLost = true
    }
    return entry
  })

  const record: DealStatsRecord = {
    version: 1,
    dealIndex: state.dealIndex,
    playerCount,
    dealerSeat: state.dealerSeat,
    contract: breakdown.contract,
    takerSeat,
    success: breakdown.success,
    diff: breakdown.diff,
    points: breakdown.points,
    required: breakdown.required,
    oudlers: breakdown.oudlers,
    multiplier: breakdown.multiplier,
    contractPart: breakdown.contractPart,
    poigneePart: breakdown.poigneePart,
    petitPart: breakdown.petitPart,
    chelemPart: breakdown.chelemPart,
    overcall,
    seats
  }
  if (partnerSeat !== undefined) {
    record.partnerSeat = partnerSeat
  }
  if (state.calledKing) {
    record.calledKing = state.calledKing
    record.calledSelf = partnerSeat === undefined
  }
  if (state.petitAuBoutCamp) {
    record.petitAuBoutCamp = state.petitAuBoutCamp
  }
  const chelem = chelemOutcome(state, breakdown.chelemPart)
  if (chelem) {
    record.chelem = chelem
  }
  if (dog.length && dealt[takerSeat]) {
    record.takerHandWithDog = analyzeHand([...dealt[takerSeat]!, ...dog])
  }
  return record
}
