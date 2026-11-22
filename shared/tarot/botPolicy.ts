import { expectedSeat } from './bid'
import { callableCards, poigneeCards, poigneeTiers } from './announces'
import { DEFAULT_BOT_LEVEL } from './apply'
import { botSuit, isRealTrump, PLAIN_SUITS, rankOf, suitCardsDesc } from './bot/cards'
import { chooseBid } from './bot/bidding'
import { chooseEcart } from './bot/ecart'
import { buildKnowledge } from './bot/knowledge'
import { cutRange } from './cut'
import { choosePlay } from './bot/play'
import { hashSeed, seededRng, type Rng } from './bot/rng'
import type { BotLevel, CardId, GameState, Intent, PlayerCount } from './types'

export { evaluateHandStrength, handPoints } from './bot/bidding'

export const BOT_LEVEL_LABELS: Record<BotLevel, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile'
}

function chienSize(playerCount: PlayerCount): 6 | 3 {
  return playerCount === 5 ? 3 : 6
}

function fullHandSize(playerCount: PlayerCount): number {
  return playerCount === 3 ? 24 : playerCount === 5 ? 15 : 18
}

function seatLevel(state: GameState, seat: number, override?: BotLevel): BotLevel {
  return override ?? state.seats[seat]?.botLevel ?? DEFAULT_BOT_LEVEL
}

function rngFor(state: GameState, seat: number, salt: string): Rng {
  return seededRng(hashSeed(state.rngCounter, state.dealIndex, state.version, seat, salt))
}

function chooseBidIntent(state: GameState, seat: number, level: BotLevel): Intent {
  if (!state.bidState) {
    throw new Error('chooseBotIntent: bidding state missing')
  }
  if (expectedSeat(state.bidState) !== seat) {
    throw new Error(`chooseBotIntent: seat ${seat} is not the expected bidder`)
  }
  const hand = state.hands[seat] ?? []
  const winner = state.bidState.currentWinner
  const bid = chooseBid(hand, state.playerCount, level, winner?.contract ?? null, rngFor(state, seat, 'bid'))
  return { type: 'bid', bid }
}

function chooseCallKingIntent(state: GameState, seat: number, level: BotLevel): Intent {
  if (!state.bid || seat !== state.bid.seat) {
    throw new Error('chooseBotIntent: only the taker may call a king')
  }
  const hand = state.hands[seat] ?? []
  const callable = callableCards(hand)
  const ranked = callable
    .map((card) => {
      const suit = botSuit(card)!
      const inSuit = hand.filter(c => botSuit(c) === suit)
      let score = inSuit.length
      if (hand.includes(card)) {
        // Calling one's own card means playing alone.
        score -= 100
      }
      if (level !== 'facile') {
        const rank = rankOf(card)
        // Holding the honour just under the called card makes it master later.
        if (inSuit.some(c => rankOf(c) === rank - 1)) {
          score += 1.5
        }
        if (inSuit.length === 0) {
          score -= 1
        }
        score += inSuit.filter(c => rankOf(c) >= 11).length * 0.3
      }
      return { card, score }
    })
    .sort((a, b) => b.score - a.score)
  return { type: 'callKing', king: ranked[0]!.card }
}

function chooseDiscardIntent(state: GameState, seat: number, level: BotLevel): Intent {
  if (!state.bid || seat !== state.bid.seat) {
    throw new Error('chooseBotIntent: only the taker may discard')
  }
  const hand = state.hands[seat] ?? []
  return { type: 'discard', cards: chooseEcart(hand, chienSize(state.playerCount), level, state.calledKing) }
}

/** Poignée to show before the bot's first card, if any (highest tier it holds). */
function poigneeIntent(state: GameState, seat: number, level: BotLevel): Intent | null {
  const hand = state.hands[seat] ?? []
  if (hand.length !== fullHandSize(state.playerCount)) {
    return null
  }
  if (state.poignees?.some(entry => entry.seat === seat)) {
    return null
  }
  if (level === 'facile' && rngFor(state, seat, 'poignee')() < 0.5) {
    return null
  }
  const tiers = [...poigneeTiers(state.playerCount)].reverse()
  const tier = tiers.find(t => poigneeCards(hand, t) !== null)
  return tier ? { type: 'announcePoignee', tier } : null
}

/**
 * Would the taker win every trick? Only with the top trumps covering every
 * trump left outside and side suits that are void or solid from the king.
 */
export function wantsChelem(hand: CardId[], ecart: CardId[]): boolean {
  const trumps = hand.filter(isRealTrump)
  const outside = 21 - trumps.length - ecart.filter(isRealTrump).length
  let topRun = 0
  for (const card of suitCardsDesc('trumps')) {
    if (!hand.includes(card)) {
      break
    }
    topRun++
  }
  if (topRun < outside) {
    return false
  }
  for (const suit of PLAIN_SUITS) {
    const cards = hand.filter(card => botSuit(card) === suit)
    const top = suitCardsDesc(suit).slice(0, cards.length)
    if (!top.every(card => cards.includes(card))) {
      return false
    }
  }
  return true
}

function canAnnounceChelem(state: GameState, seat: number): boolean {
  return state.phase === 'ReadyToPlay'
    && Boolean(state.bid)
    && state.bid!.seat === seat
    && !state.chelemAnnounce
    && state.trick.length === 0
    && (state.playedTricks?.length ?? 0) === 0
    && !(state.playerCount === 5 && !state.calledKing)
}

/** A bot taker announcing a chelem before the first card (or null). */
export function botChelemIntent(state: GameState, seat: number, override?: BotLevel): Intent | null {
  const level = seatLevel(state, seat, override)
  if (level === 'facile' || !canAnnounceChelem(state, seat)) {
    return null
  }
  if (!wantsChelem(state.hands[seat] ?? [], state.ecart)) {
    return null
  }
  return { type: 'announceChelem', kind: 'announced' }
}

function choosePlayIntent(state: GameState, seat: number, level: BotLevel): Intent {
  const chelem = botChelemIntent(state, seat, level)
  if (chelem) {
    return chelem
  }
  const poignee = poigneeIntent(state, seat, level)
  if (poignee) {
    return poignee
  }
  const knowledge = buildKnowledge(state, seat, level)
  if (knowledge.legal.length === 0) {
    throw new Error('chooseBotIntent: no legal moves')
  }
  const card = choosePlay(knowledge, rngFor(state, seat, 'play'))
  return { type: 'playCard', card }
}

/**
 * A cut like people make one: roughly in the middle of the pack, never the
 * same place twice, always leaving more than 3 cards on each side.
 */
export function chooseCutIntent(state: GameState, seat: number): Intent {
  const size = state.deck?.length ?? 78
  const { min, max } = cutRange(size)
  const rng = rngFor(state, seat, 'cut')
  // Average of two draws: most cuts land near the middle, some far off it.
  const spread = (rng() + rng()) / 2
  const at = Math.round(min + spread * (max - min))
  return { type: 'cut', at: Math.min(max, Math.max(min, at)) }
}

/**
 * What a bot does at `seat`. It only uses what that seat may know (see
 * `buildKnowledge`): its hand, the cards everyone saw and what the play shows.
 */
export function chooseBotIntent(state: GameState, seat: number, levelOverride?: BotLevel): Intent {
  const level = seatLevel(state, seat, levelOverride)
  if (
    state.playerCount === 5
    && state.bid
    && !state.calledKing
    && (state.phase === 'DogEcarta' || state.phase === 'ReadyToPlay')
  ) {
    if (seat !== state.bid.seat) {
      throw new Error(`chooseBotIntent: waiting for taker to call a king`)
    }
    return chooseCallKingIntent(state, seat, level)
  }

  if (state.phase === 'Scoring') {
    return { type: 'continue' }
  }

  if (state.currentSeat !== seat) {
    throw new Error(`chooseBotIntent: not seat ${seat}'s turn`)
  }

  switch (state.phase) {
    case 'Cutting':
      return chooseCutIntent(state, seat)
    case 'Bidding':
      return chooseBidIntent(state, seat, level)
    case 'DogEcarta':
      return chooseDiscardIntent(state, seat, level)
    case 'Trick':
    case 'ReadyToPlay':
      return choosePlayIntent(state, seat, level)
    default:
      throw new Error(`chooseBotIntent: unsupported phase ${state.phase}`)
  }
}
