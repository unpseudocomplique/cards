import type { CardId } from '../types'
import {
  botSuit,
  currentWinner,
  isExcuse,
  isRealTrump,
  ledSuitOf,
  PETIT,
  points,
  rankOf,
  VINGT_ET_UN,
  type BotSuit
} from './cards'
import { isMaster, unseenInSuit, type Knowledge } from './knowledge'
import type { Rng } from './rng'
import { simulatePlay } from './simulate'

type Entry = { seat: number, card: CardId }

/** Extra weight of an oudler that can change camp (the Petit): it moves the contract target. */
const OUDLER_SWING = 9
const PETIT_AU_BOUT = 10

function seatsAfterMe(k: Knowledge): number[] {
  const remaining = k.playerCount - k.trick.length - 1
  return Array.from({ length: remaining }, (_, i) => (k.seat + 1 + i) % k.playerCount)
}

/** How many places could hide an unseen card of `suit` (other players not void, plus a hidden pile). */
function holders(k: Knowledge, suit: BotSuit): number {
  let count = 0
  for (let s = 0; s < k.playerCount; s++) {
    if (s !== k.seat && !k.voids[s]![suit]) {
      count++
    }
  }
  if (k.hiddenPile > 0 && suit !== 'trumps') {
    count += 0.5
  }
  return Math.max(count, 1)
}

/** Probability that seat `s` holds at least one of `cards`. */
function pHoldsAny(k: Knowledge, s: number, cards: CardId[]): number {
  let pNone = 1
  for (const card of cards) {
    const holder = k.knownHolder.get(card)
    if (holder !== undefined) {
      if (holder === s) {
        return 1
      }
      continue
    }
    const suit = botSuit(card)
    if (!suit || k.voids[s]![suit]) {
      continue
    }
    if (suit === 'trumps' && rankOf(card) > k.maxTrump[s]!) {
      continue
    }
    pNone *= 1 - 1 / holders(k, suit)
  }
  return 1 - pNone
}

function pVoid(k: Knowledge, s: number, suit: BotSuit): number {
  if (k.voids[s]![suit]) {
    return 1
  }
  for (const [card, holder] of k.knownHolder) {
    if (holder === s && botSuit(card) === suit) {
      return 0
    }
  }
  if (k.level === 'facile') {
    return 0.05
  }
  const out = unseenInSuit(k, suit).filter(card => k.knownHolder.get(card) === undefined).length
  const expected = out / holders(k, suit)
  return Math.min(0.95, Math.max(0.02, Math.exp(-expected)))
}

/** Probability that seat `s`, still to play, beats `best` in a trick led in `led`. */
function pBeat(k: Knowledge, s: number, best: CardId, led: BotSuit): number {
  const bestSuit = botSuit(best)
  if (bestSuit === 'trumps') {
    const higher = unseenInSuit(k, 'trumps', rankOf(best))
    const pHigher = pHoldsAny(k, s, higher)
    return led === 'trumps' ? pHigher : pVoid(k, s, led) * pHigher
  }
  const higher = unseenInSuit(k, led, rankOf(best))
  const pv = pVoid(k, s, led)
  const pHigher = k.voids[s]![led] ? 0 : pHoldsAny(k, s, higher)
  const pTrump = k.voids[s]!.trumps ? 0 : pHoldsAny(k, s, unseenInSuit(k, 'trumps'))
  return (1 - pv) * pHigher + pv * pTrump
}

function cardValue(card: CardId, lastTrick: boolean): number {
  if (card === VINGT_ET_UN || isExcuse(card)) {
    // The 21 can never be lost and the Excuse goes back to its camp.
    return 0
  }
  if (card === PETIT) {
    return points(card) + OUDLER_SWING + (lastTrick ? PETIT_AU_BOUT : 0)
  }
  return points(card)
}

/** Probability that my camp wins the trick once `trick` has been played and the others follow. */
function trickOdds(k: Knowledge, trick: Entry[]): { pOurs: number, value: number } {
  const later = seatsAfterMe(k)
  const lastTrick = k.hand.length === 1
  const winner = currentWinner(trick)
  const led = ledSuitOf(trick)
  let value = trick.reduce((sum, entry) => sum + cardValue(entry.card, lastTrick), 0)
  if (!winner || !led) {
    return { pOurs: 0.5, value }
  }
  let pOppNone = 1
  let pAllyNone = 1
  for (const s of later) {
    const p = pBeat(k, s, winner.card, led)
    const ally = k.allyProb[s]!
    pOppNone *= 1 - p * (1 - ally)
    pAllyNone *= 1 - p * ally
  }
  const pOppBeat = 1 - pOppNone
  const pAllyBeat = 1 - pAllyNone
  const wAlly = k.allyProb[winner.seat]!
  const pOurs = Math.min(1, Math.max(0,
    wAlly * (1 - pOppBeat + pOppBeat * pAllyBeat * 0.4)
    + (1 - wAlly) * pAllyBeat * (1 - 0.5 * pOppBeat)
  ))
  for (const s of later) {
    const ally = k.allyProb[s]!
    value += ally * (pOurs > 0.6 ? 2.5 : 0.8) + (1 - ally) * 0.7
  }
  return { pOurs, value }
}

function trumpsOutsideMyCamp(k: Knowledge): number {
  let count = 0
  for (const card of k.unseen) {
    if (!isRealTrump(card)) {
      continue
    }
    const holder = k.knownHolder.get(card)
    if (holder !== undefined && k.allyProb[holder]! >= 0.99) {
      continue
    }
    count++
  }
  return count
}

/** What a card in hand is still worth for the rest of the deal if I keep it. */
function keepValue(k: Knowledge, card: CardId): number {
  const handLeft = k.hand.length
  if (isExcuse(card)) {
    return handLeft > 6 ? 2 : 1
  }
  if (card === PETIT) {
    if (k.level === 'facile') {
      return 0
    }
    const outside = trumpsOutsideMyCamp(k)
    if (outside === 0) {
      // Nobody can take it any more: keep it for the last trick.
      return 15
    }
    const myTrumps = k.hand.filter(c => isRealTrump(c) && c !== PETIT).length
    if (k.level === 'difficile' && myTrumps >= outside + 2 && handLeft > 3) {
      // Strong enough to draw every trump and bring it home at the end.
      return 3
    }
    // At risk while it stays in hand: happy to save it.
    return -1.5
  }
  if (isRealTrump(card)) {
    const base = 0.5 + 0.15 * rankOf(card)
    return k.attack ? base * 1.2 : base
  }
  const pts = points(card)
  if (k.level !== 'facile' && isMaster(k, card)) {
    const suit = botSuit(card)!
    let pTrumpedLater = 0
    for (let s = 0; s < k.playerCount; s++) {
      if (s !== k.seat && k.allyProb[s]! < 0.5) {
        pTrumpedLater = Math.max(pTrumpedLater, pVoid(k, s, suit) * (k.voids[s]!.trumps ? 0 : 1))
      }
    }
    // Kept, it should win a later trick, unless someone trumps it.
    return (1 - pTrumpedLater) * (pts + 2.5) - pTrumpedLater * pts
  }
  if (pts >= 1.5) {
    return 0.3 * pts
  }
  return 0.02 * rankOf(card)
}

function leadBonus(k: Knowledge, card: CardId): number {
  if (k.trick.length > 0 || k.level === 'facile') {
    return 0
  }
  let bonus = 0
  const suit = botSuit(card)
  const outside = trumpsOutsideMyCamp(k)
  if (suit === 'trumps') {
    const myTrumps = k.hand.filter(isRealTrump).length
    if (k.attack) {
      if (outside > 0 && myTrumps >= Math.max(3, outside * 0.8)) {
        // Draw the defence's trumps.
        bonus += isMaster(k, card) ? 2.5 : 1.2
        if (k.level === 'difficile' && k.unseen.has(PETIT) && rankOf(card) >= 15) {
          // Hunting the Petit.
          bonus += 1.5
        }
      }
      if (outside === 0) {
        bonus -= 2
      }
    } else {
      bonus -= 2
    }
  } else if (suit) {
    if (k.calledKing && k.playerCount === 5 && k.seat === k.taker && k.allyProb.some((p, s) => s !== k.seat && p > 0 && p < 1)) {
      // 5 players: lead small in the called suit to find the partner.
      if (botSuit(k.calledKing) === suit && card !== k.calledKing && points(card) <= 0.5 && k.tricksPlayed < 5) {
        bonus += 2
      }
    }
    if (k.level === 'difficile' && !k.attack && k.voids[k.taker]![suit] && !k.voids[k.taker]!.trumps && points(card) <= 0.5) {
      // Make the taker spend trumps.
      bonus += 0.8
    }
  }
  return bonus
}

function excuseScore(k: Knowledge): number {
  const handLeft = k.hand.length
  const campWonAll = k.campTricks.theirs === 0 && k.tricksPlayed > 0
  if (handLeft <= 2) {
    // Never keep the Excuse for the last trick (it would change camp), unless
    // my camp has won every trick: then it wins the last one (chelem).
    if (campWonAll && (k.chelemAnnounced || k.level === 'difficile') && k.attack) {
      return -50
    }
    return 50
  }
  if (campWonAll && k.chelemAnnounced && k.attack) {
    return -50
  }
  const { pOurs, value } = k.trick.length > 0 ? trickOdds(k, k.trick) : { pOurs: 0.5, value: 0 }
  return (2 * pOurs - 1) * value - keepValue(k, 'excuse' as CardId) - (k.trick.length === 0 ? 0.5 : 0)
}

export function scoreMove(k: Knowledge, card: CardId): number {
  if (isExcuse(card)) {
    return excuseScore(k)
  }
  const trick = [...k.trick, { seat: k.seat, card }]
  const { pOurs, value } = trickOdds(k, trick)
  return (2 * pOurs - 1) * value - keepValue(k, card) + leadBonus(k, card)
}

const NOISE: Record<Knowledge['level'], number> = { facile: 2.5, moyen: 0.6, difficile: 0.05 }

export function choosePlay(k: Knowledge, rng: Rng): CardId {
  const legal = k.legal
  if (legal.length === 1) {
    return legal[0]!
  }
  if (k.level === 'difficile') {
    return simulatePlay(k, rng, card => scoreMove(k, card))
  }
  if (k.level === 'facile' && rng() < 0.2) {
    return legal[Math.floor(rng() * legal.length)]!
  }
  let best = legal[0]!
  let bestScore = -Infinity
  for (const card of legal) {
    const score = scoreMove(k, card) + (rng() - 0.5) * 2 * NOISE[k.level]
    if (score > bestScore) {
      best = card
      bestScore = score
    }
  }
  return best
}
