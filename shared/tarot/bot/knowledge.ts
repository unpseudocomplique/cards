import { buildTarot78Deck } from '../deck'
import { legalMovesForSeat } from '../legalMoves'
import type { Contract } from '../bid'
import type { BotLevel, CardId, GameState } from '../types'
import {
  ALL_SUITS,
  botSuit,
  currentWinner,
  isRealTrump,
  ledSuitOf,
  points,
  rankOf,
  type BotSuit
} from './cards'

type Entry = { seat: number, card: CardId }

/**
 * Everything one seat may legitimately know: its own hand, the cards everyone
 * saw (tricks, a prise/garde dog, poignées, trumps shown in the écart), its own
 * écart when it is the taker, and what can be deduced from the play. It is
 * built from the game state but never reads another player's hand.
 */
export type Knowledge = {
  seat: number
  level: BotLevel
  playerCount: number
  hand: CardId[]
  /** Cards left in each hand (public). */
  handCounts: number[]
  legal: CardId[]
  taker: number
  contract: Contract
  calledKing?: CardId
  /** Am I in the taker's camp (taker, or holder of the called card)? */
  attack: boolean
  /** Probability that each seat plays in my camp (1 for me). */
  allyProb: number[]
  /** Cards played in completed tricks and in the current trick. */
  played: Set<CardId>
  history: Entry[][]
  trick: Entry[]
  /** Cards whose place I do not know (not mine, not played, not my own écart). */
  unseen: Set<CardId>
  /** Cards I know are in a given seat's hand (poignées, dog honours of the taker). */
  knownHolder: Map<CardId, number>
  /** voids[seat][suit]: the seat showed it has no card of that suit left. */
  voids: Array<Record<BotSuit, boolean>>
  /** Highest trump a seat can still hold (deduced from failed overtrumps). */
  maxTrump: number[]
  /** Cards hidden from me that nobody holds (dog of a garde sans/contre, écart of someone else). */
  hiddenPile: number
  tricksPlayed: number
  /** Tricks won so far by my camp / by the other camp (as far as I can tell). */
  campTricks: { mine: number, theirs: number }
  chelemAnnounced: boolean
}

function emptyVoids(): Record<BotSuit, boolean> {
  return { hearts: false, diamonds: false, clubs: false, spades: false, trumps: false }
}

/** Seat holding the called card, as far as `seat` can tell (null when unknown). */
function knownPartner(state: GameState, seat: number, played: Entry[]): number | null | 'alone' {
  if (state.playerCount !== 5 || !state.bid) {
    return null
  }
  const king = state.calledKing
  if (!king) {
    return null
  }
  if ((state.hands[seat] ?? []).includes(king)) {
    return seat === state.bid.seat ? 'alone' : seat
  }
  const playedEntry = played.find(entry => entry.card === king)
  if (playedEntry) {
    return playedEntry.seat === state.bid.seat ? 'alone' : playedEntry.seat
  }
  if (state.dogSeen?.includes(king)) {
    // The called card was in the dog everyone saw: the taker plays alone.
    return 'alone'
  }
  if (seat === state.bid.seat && state.ecart.includes(king)) {
    return 'alone'
  }
  return null
}

/**
 * 5 players, partner still hidden: guess who holds the called card from the
 * way each seat played (charging the taker's tricks, beating the taker...).
 */
function partnerSuspicion(state: GameState, seat: number, history: Entry[][], level: BotLevel): number[] {
  const taker = state.bid!.seat
  const score = Array.from({ length: state.playerCount }, () => 0)
  if (level !== 'difficile') {
    return score
  }
  const king = state.calledKing!
  const calledSuit = botSuit(king)
  for (const trick of history) {
    const winner = currentWinner(trick)
    if (!winner) {
      continue
    }
    const led = ledSuitOf(trick)
    for (const entry of trick) {
      if (entry.seat === taker || entry.seat === seat || entry.card === 'excuse') {
        continue
      }
      const pts = points(entry.card)
      if (winner.seat === taker && entry.seat !== taker) {
        // Gave points to the taker's trick without being forced to: partner-ish.
        if (pts >= 2.5 && botSuit(entry.card) !== led) {
          score[entry.seat]! += 1.5
        } else if (pts >= 2.5) {
          score[entry.seat]! += 0.6
        }
      }
      if (winner.seat === entry.seat) {
        const takerEntry = trick.find(e => e.seat === taker)
        const takerIndex = trick.findIndex(e => e.seat === taker)
        const myIndex = trick.findIndex(e => e.seat === entry.seat)
        if (takerEntry && takerIndex < myIndex && takerEntry.card !== 'excuse') {
          // Beat a card the taker had played: defender-ish.
          score[entry.seat]! -= 1.5
        }
      }
      if (led === calledSuit && trick[0]?.seat === entry.seat && entry.card !== king) {
        // Leading the called suit from below is what the defence does to flush the king.
        score[entry.seat]! -= 0.5
      }
    }
  }
  return score
}

function computeAllyProb(state: GameState, seat: number, history: Entry[][], level: BotLevel, attack: boolean, partner: number | null | 'alone'): number[] {
  const n = state.playerCount
  const taker = state.bid!.seat
  const prob: number[] = Array.from({ length: n }, (_, s) => (s === seat ? 1 : 0))
  if (n !== 5) {
    for (let s = 0; s < n; s++) {
      if (s === seat) {
        continue
      }
      prob[s] = attack ? 0 : (s === taker ? 0 : 1)
    }
    return prob
  }
  if (partner !== null) {
    const attackSet = new Set<number>([taker])
    if (partner !== 'alone') {
      attackSet.add(partner)
    }
    for (let s = 0; s < n; s++) {
      if (s !== seat) {
        prob[s] = attackSet.has(s) === attack ? 1 : 0
      }
    }
    return prob
  }
  // Partner unknown to me. I am either the taker or a defender without the card.
  const candidates = Array.from({ length: n }, (_, s) => s).filter(s => s !== taker && s !== seat)
  const suspicion = partnerSuspicion(state, seat, history, level)
  const weights = candidates.map(s => Math.exp(suspicion[s]!))
  const total = weights.reduce((a, b) => a + b, 0)
  // Defenders: one of the candidates is the partner; taker: one of them (or nobody).
  const partnerShare = seat === taker ? 0.95 : 1
  candidates.forEach((s, i) => {
    const pPartner = partnerShare * weights[i]! / total
    prob[s] = attack ? pPartner : 1 - pPartner
  })
  if (seat !== taker) {
    prob[taker] = 0
  }
  return prob
}

export function buildKnowledge(state: GameState, seat: number, level: BotLevel): Knowledge {
  if (!state.bid) {
    throw new Error('buildKnowledge: no contract')
  }
  const hand = [...(state.hands[seat] ?? [])]
  const taker = state.bid.seat
  const remember = level !== 'facile'
  const fullHistory = (state.playedTricks ?? []).map(trick => trick.map(entry => ({ ...entry })))
  // An easy bot only remembers the last trick.
  const history = remember ? fullHistory : fullHistory.slice(-1)
  const trick = state.trick.map(entry => ({ ...entry }))
  const allPlayed = [...fullHistory.flat(), ...trick]

  const partner = knownPartner(state, seat, allPlayed)
  const attack = seat === taker || (typeof partner === 'number' && partner === seat)

  const played = new Set<CardId>([...history.flat(), ...trick].map(entry => entry.card))
  const unseen = new Set<CardId>(buildTarot78Deck())
  for (const card of hand) {
    unseen.delete(card)
  }
  for (const card of played) {
    unseen.delete(card)
  }
  if (seat === taker) {
    for (const card of state.ecart) {
      unseen.delete(card)
    }
  }
  if (!remember) {
    // Without memory, cards from older tricks look like they are still out.
    for (const entry of fullHistory.slice(0, -1).flat()) {
      if (!hand.includes(entry.card)) {
        unseen.add(entry.card)
      }
    }
  }

  const knownHolder = new Map<CardId, number>()
  if (remember) {
    for (const poignee of state.poignees ?? []) {
      for (const card of poignee.cards) {
        if (unseen.has(card)) {
          knownHolder.set(card, poignee.seat)
        }
      }
    }
    if (seat !== taker && state.dogSeen) {
      const shownInEcart = new Set(state.ecartShownTrumps ?? [])
      for (const card of state.dogSeen) {
        // Kings and trumps of the dog cannot be discarded (unless shown): the taker has them.
        const keeps = card.endsWith('-k') || card === 'excuse' || (isRealTrump(card) && !shownInEcart.has(card))
        if (keeps && unseen.has(card)) {
          knownHolder.set(card, taker)
        }
      }
    }
    if (seat !== taker) {
      for (const card of state.ecartShownTrumps ?? []) {
        unseen.delete(card)
      }
    }
  }

  const n = state.playerCount
  const voids = Array.from({ length: n }, emptyVoids)
  const maxTrump = Array.from({ length: n }, () => 21)
  if (level === 'difficile') {
    for (const t of [...history, trick]) {
      const led = ledSuitOf(t)
      if (!led) {
        continue
      }
      let best: Entry | null = null
      for (const entry of t) {
        if (entry.card === 'excuse') {
          continue
        }
        const suit = botSuit(entry.card)
        const firstReal = t.find(e => e.card !== 'excuse')
        if (entry !== firstReal) {
          if (suit !== led) {
            voids[entry.seat]![led] = true
            if (suit !== 'trumps') {
              voids[entry.seat]!.trumps = true
            }
          }
          const bestTrump = best && botSuit(best.card) === 'trumps' ? rankOf(best.card) : 0
          if (suit === 'trumps' && bestTrump > 0 && rankOf(entry.card) < bestTrump) {
            // Did not overtrump: holds nothing above the best trump.
            maxTrump[entry.seat] = Math.min(maxTrump[entry.seat]!, bestTrump)
          }
        }
        if (!best || (botSuit(entry.card) === 'trumps' && (botSuit(best.card) !== 'trumps' || rankOf(entry.card) > rankOf(best.card)))
          || (botSuit(entry.card) === led && botSuit(best.card) === led && rankOf(entry.card) > rankOf(best.card))) {
          best = entry
        }
      }
    }
  }
  for (let s = 0; s < n; s++) {
    if (s === seat) {
      for (const suit of ALL_SUITS) {
        voids[s]![suit] = !hand.some(card => botSuit(card) === suit)
      }
    }
  }

  let hiddenPile = 0
  const dogSize = n === 5 ? 3 : 6
  if (state.bid.contract === 'garde_sans' || state.bid.contract === 'garde_contre') {
    hiddenPile = dogSize
  } else if (seat !== taker) {
    hiddenPile = dogSize - (state.ecartShownTrumps?.length ?? 0)
  }

  const allyProb = computeAllyProb(state, seat, history, level, attack, partner)

  let mine = 0
  let theirs = 0
  for (const t of fullHistory) {
    const winner = currentWinner(t)
    if (!winner) {
      continue
    }
    if ((allyProb[winner.seat] ?? 0) >= 0.5) {
      mine++
    } else {
      theirs++
    }
  }

  return {
    seat,
    level,
    playerCount: n,
    hand,
    handCounts: state.hands.map(h => h.length),
    legal: legalMovesForSeat(state, seat),
    taker,
    contract: state.bid.contract,
    calledKing: state.calledKing,
    attack,
    allyProb,
    played,
    history,
    trick,
    unseen,
    knownHolder,
    voids,
    maxTrump,
    hiddenPile,
    tricksPlayed: fullHistory.length,
    campTricks: { mine, theirs },
    chelemAnnounced: state.chelemAnnounce === 'announced'
  }
}

/** Unseen cards of a suit, optionally only those above `rank`. */
export function unseenInSuit(k: Knowledge, suit: BotSuit, above = 0): CardId[] {
  const out: CardId[] = []
  for (const card of k.unseen) {
    if (botSuit(card) === suit && rankOf(card) > above) {
      out.push(card)
    }
  }
  return out
}

/** Is `card` (in my hand) the highest card of its suit still out? */
export function isMaster(k: Knowledge, card: CardId): boolean {
  const suit = botSuit(card)
  if (!suit) {
    return false
  }
  return unseenInSuit(k, suit, rankOf(card)).length === 0
}
