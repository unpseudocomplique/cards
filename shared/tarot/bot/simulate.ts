import { legalMoves } from '../legalMoves'
import type { CardId } from '../types'
import {
  beats,
  botSuit,
  currentWinner,
  isRealTrump,
  ledSuitOf,
  PETIT,
  points,
  rankOf,
  type BotSuit
} from './cards'
import type { Knowledge } from './knowledge'
import type { Rng } from './rng'

/**
 * "Difficile" card play: try each legal card in many deals that are possible
 * given what the bot knows (its hand, the cards seen, the voids shown...),
 * play the rest of the deal out quickly in each of them and keep the card that
 * brings its camp the most points on average. The other hands are only ever
 * guessed: the real ones are never read.
 */

type Entry = { seat: number, card: CardId }

type World = {
  hands: CardId[][]
  attack: boolean[]
}

function isPetit(card: CardId): boolean {
  return card === PETIT
}

/** Points a camp banks by winning `card` (the Petit also moves the target). */
function bankValue(card: CardId, lastTrick: boolean): number {
  if (card === 'excuse') {
    return 0
  }
  if (isPetit(card)) {
    return points(card) + 9 + (lastTrick ? 10 : 0)
  }
  if (card === 'trump-21') {
    return 0
  }
  return points(card)
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Deal the unseen cards to the other seats (and the hidden pile) respecting what is known. */
export function sampleWorld(k: Knowledge, handCounts: number[], rng: Rng, takerHasCalled: number | null): World | null {
  const n = k.playerCount
  const hands: CardId[][] = Array.from({ length: n }, (_, s) => (s === k.seat ? [...k.hand] : []))
  const capacity = handCounts.map((count, s) => (s === k.seat ? 0 : count))
  const pileCapacity = k.hiddenPile
  const pileIsEcart = k.contract === 'prise' || k.contract === 'garde'
  let pileUsed = 0

  const pool: CardId[] = []
  for (const card of k.unseen) {
    const holder = k.knownHolder.get(card)
    if (holder !== undefined && holder !== k.seat && capacity[holder]! > 0) {
      hands[holder]!.push(card)
      capacity[holder]!--
      continue
    }
    pool.push(card)
  }

  const allowed = (s: number, card: CardId): boolean => {
    const suit = botSuit(card)
    if (suit && k.voids[s]![suit]) {
      return false
    }
    if (suit === 'trumps' && rankOf(card) > k.maxTrump[s]!) {
      return false
    }
    return true
  }
  const pileAllowed = (card: CardId): boolean => {
    if (!pileIsEcart) {
      return true
    }
    // The taker's écart: no king, no trump (shown trumps are already known), no Excuse.
    return botSuit(card) !== 'trumps' && card !== 'excuse' && !card.endsWith('-k')
  }

  // Most constrained cards first.
  const options = shuffle(pool, rng).map((card) => {
    const seats: number[] = []
    for (let s = 0; s < n; s++) {
      if (s !== k.seat && allowed(s, card)) {
        seats.push(s)
      }
    }
    return { card, seats, pile: pileCapacity > 0 && pileAllowed(card) }
  }).sort((a, b) => (a.seats.length + (a.pile ? 1 : 0)) - (b.seats.length + (b.pile ? 1 : 0)))

  for (const { card, seats, pile } of options) {
    let total = 0
    for (const s of seats) {
      total += capacity[s]!
    }
    const pileRoom = pile ? pileCapacity - pileUsed : 0
    total += pileRoom
    if (total <= 0) {
      return null
    }
    let pick = rng() * total
    let placed = false
    for (const s of seats) {
      pick -= capacity[s]!
      if (pick < 0) {
        hands[s]!.push(card)
        capacity[s]!--
        placed = true
        break
      }
    }
    if (!placed) {
      if (pileRoom <= 0) {
        return null
      }
      pileUsed++
    }
  }
  if (capacity.some(c => c !== 0)) {
    return null
  }

  const attack = Array.from({ length: n }, (_, s) => s === k.taker)
  if (n === 5 && k.calledKing) {
    let partner = takerHasCalled
    if (partner === null) {
      partner = hands.findIndex(hand => hand.includes(k.calledKing!))
    }
    if (partner !== null && partner >= 0) {
      attack[partner] = true
    }
  }
  return { hands, attack }
}

/** Can any seat in `later` beat `best` with what it holds (perfect information inside the world)? */
function someoneBeats(world: World, later: number[], best: CardId, led: BotSuit, camp: boolean): boolean {
  for (const s of later) {
    if (world.attack[s] === camp) {
      continue
    }
    const hand = world.hands[s]!
    const hasLed = hand.some(card => botSuit(card) === led)
    for (const card of hand) {
      const suit = botSuit(card)
      if (hasLed && suit !== led) {
        continue
      }
      if (!hasLed && suit !== 'trumps' && hand.some(isRealTrump)) {
        continue
      }
      if (beats(card, best, led)) {
        return true
      }
    }
  }
  return false
}

function lowest(cards: CardId[]): CardId {
  let best = cards[0]!
  let bestKey = Infinity
  for (const card of cards) {
    const key = (card === 'excuse' ? 50 : 0) + points(card) * 10 + (isRealTrump(card) ? 30 + rankOf(card) * 0.5 : rankOf(card) * 0.1) + (isPetit(card) ? 100 : 0)
    if (key < bestKey) {
      best = card
      bestKey = key
    }
  }
  return best
}

function richest(cards: CardId[]): CardId {
  let best = cards[0]!
  let bestKey = -Infinity
  for (const card of cards) {
    const key = card === 'excuse' ? -100 : points(card) * 10 - (isRealTrump(card) ? 40 + rankOf(card) : 0) + (isPetit(card) ? 200 : 0) - (card === 'trump-21' ? 100 : 0)
    if (key > bestKey) {
      best = card
      bestKey = key
    }
  }
  return best
}

/** Fast rule-based play used inside the simulated deals. */
function rolloutMove(world: World, seat: number, trick: Entry[], n: number): CardId {
  const hand = world.hands[seat]!
  const moves = legalMoves(hand, trick, null)
  if (moves.length === 1) {
    return moves[0]!
  }
  const nonExcuse = moves.filter(card => card !== 'excuse')
  if (hand.length <= 2 && moves.includes('excuse' as CardId)) {
    return 'excuse' as CardId
  }
  const camp = world.attack[seat]!
  const later = Array.from({ length: n - trick.length - 1 }, (_, i) => (seat + 1 + i) % n)
  if (trick.length === 0) {
    // Lead a sure winner with the most points, otherwise a small card.
    let bestSure: CardId | null = null
    for (const card of nonExcuse) {
      const suit = botSuit(card)!
      if (!someoneBeats(world, later, card, suit, camp)) {
        if (!bestSure || points(card) > points(bestSure) || (isRealTrump(bestSure) && !isRealTrump(card))) {
          bestSure = card
        }
      }
    }
    if (bestSure && !isPetit(bestSure)) {
      return bestSure
    }
    if (bestSure) {
      return bestSure
    }
    return lowest(nonExcuse.length > 0 ? nonExcuse : moves)
  }
  const led = ledSuitOf(trick)
  const winner = currentWinner(trick)
  if (!led || !winner) {
    return lowest(nonExcuse.length > 0 ? nonExcuse : moves)
  }
  if (world.attack[winner.seat] === camp && !someoneBeats(world, later, winner.card, led, camp)) {
    // Trick is ours: give points, but keep trumps.
    const safe = nonExcuse.filter(card => !isRealTrump(card) || isPetit(card) || !beats(card, winner.card, led))
    const pool = safe.length > 0 ? safe : nonExcuse
    return richest(pool.length > 0 ? pool : moves)
  }
  // Try to win it with the cheapest card that nobody after can beat.
  const winners = nonExcuse.filter(card => beats(card, winner.card, led) && !someoneBeats(world, later, card, led, camp))
  if (winners.length > 0) {
    if (winners.some(isPetit)) {
      return PETIT
    }
    return winners.reduce((a, b) => {
      const ka = isRealTrump(a) ? 20 + rankOf(a) : rankOf(a) - points(a) * 2
      const kb = isRealTrump(b) ? 20 + rankOf(b) : rankOf(b) - points(b) * 2
      return kb < ka ? b : a
    })
  }
  const cheap = lowest(nonExcuse.length > 0 ? nonExcuse : moves)
  if (moves.includes('excuse' as CardId) && (points(cheap) >= 2.5 || isPetit(cheap))) {
    return 'excuse' as CardId
  }
  return cheap
}

/** Play the deal to the end in `world` and return the points banked by `seat`'s camp. */
function playOut(world: World, trickStart: Entry[], seat: number, n: number, firstMove: CardId): number {
  const hands = world.hands.map(hand => [...hand])
  const w: World = { hands, attack: world.attack }
  let trick = [...trickStart]
  let current = seat
  let move: CardId | null = firstMove
  const myCamp = world.attack[seat]!
  let banked = 0
  for (;;) {
    const card: CardId = move ?? rolloutMove(w, current, trick, n)
    move = null
    const hand = hands[current]!
    const idx = hand.indexOf(card)
    hand.splice(idx, 1)
    trick.push({ seat: current, card })
    if (trick.length === n) {
      const lastTrick = hands.every(h => h.length === 0)
      const win = currentWinner(trick)!
      const winCamp = world.attack[win.seat]!
      for (const entry of trick) {
        const value = bankValue(entry.card, lastTrick)
        if (entry.card === 'excuse') {
          continue
        }
        banked += winCamp === myCamp ? value : -value
      }
      if (lastTrick) {
        return banked
      }
      trick = []
      current = win.seat
    } else {
      current = (current + 1) % n
    }
  }
}

export function simulatePlay(
  k: Knowledge,
  rng: Rng,
  baseline: (card: CardId) => number
): CardId {
  const legal = k.legal
  const totals = new Map<CardId, number>(legal.map(card => [card, 0]))
  const handCounts = k.handCounts
  const remaining = handCounts.reduce((a, b) => a + b, 0)
  const samples = Math.max(12, Math.min(48, Math.floor(9000 / (legal.length * Math.max(remaining, 1)))))
  const partner = k.playerCount === 5 && k.calledKing
    ? (k.history.flat().concat(k.trick).find(entry => entry.card === k.calledKing)?.seat ?? (k.hand.includes(k.calledKing) ? k.seat : null))
    : null
  let worlds = 0
  for (let i = 0; i < samples * 3 && worlds < samples; i++) {
    const world = sampleWorld(k, handCounts, rng, partner)
    if (!world) {
      continue
    }
    worlds++
    for (const card of legal) {
      totals.set(card, totals.get(card)! + playOut(world, k.trick, k.seat, k.playerCount, card))
    }
  }
  if (worlds === 0) {
    let best = legal[0]!
    for (const card of legal) {
      if (baseline(card) > baseline(best)) {
        best = card
      }
    }
    return best
  }
  let best = legal[0]!
  let bestScore = -Infinity
  for (const card of legal) {
    // The heuristic score breaks near-ties and carries what the roll-outs miss.
    const score = totals.get(card)! / worlds + 0.35 * baseline(card)
    if (score > bestScore) {
      best = card
      bestScore = score
    }
  }
  return best
}
