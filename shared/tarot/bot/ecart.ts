import { isOudler, isTrump } from '../deck'
import { validateEcart } from '../ecart'
import type { BotLevel, CardId } from '../types'
import { botSuit, isRealTrump, PLAIN_SUITS, points, rankOf } from './cards'

function isLegalDiscard(card: CardId): boolean {
  return !isTrump(card) && !card.endsWith('-k')
}

function lowestFirst(a: CardId, b: CardId): number {
  return rankOf(a) - rankOf(b)
}

/** Old behaviour: the lowest legal cards. */
function naiveEcart(hand: CardId[], size: number): CardId[] {
  return hand.filter(isLegalDiscard).sort(lowestFirst).slice(0, size)
}

function ecartValue(hand: CardId[], discard: CardId[], calledKing: CardId | undefined): number {
  const kept = hand.filter(card => !discard.includes(card))
  const trumpCount = kept.filter(isRealTrump).length + (kept.includes('excuse' as CardId) ? 1 : 0)
  let value = 0
  for (const card of discard) {
    const suit = botSuit(card)!
    const pts = points(card)
    if (pts <= 0.5) {
      value += 0.5
      continue
    }
    const hasKing = kept.includes(`${suit}-k` as CardId)
    // Honours without the king are likely lost to the defence: banking them counts double.
    value += hasKing ? pts * 0.6 : pts * 1.6
  }
  const calledSuit = calledKing ? botSuit(calledKing) : null
  for (const suit of PLAIN_SUITS) {
    const cards = kept.filter(card => botSuit(card) === suit)
    if (cards.length === 0) {
      value += suit === calledSuit ? -3 : 4 + 0.6 * trumpCount
    } else if (cards.length === 1) {
      value += cards[0]!.endsWith('-k') ? -0.5 : 1.5
    }
    // Honours left without protection are at risk.
    for (const card of cards) {
      if (card.endsWith('-q') && !cards.includes(`${suit}-k` as CardId) && cards.length < 4) {
        value -= 1
      }
    }
  }
  return value
}

function* combinations(items: CardId[], size: number, start = 0, picked: CardId[] = []): Generator<CardId[]> {
  if (picked.length === size) {
    yield [...picked]
    return
  }
  for (let i = start; i <= items.length - (size - picked.length); i++) {
    picked.push(items[i]!)
    yield* combinations(items, size, i + 1, picked)
    picked.pop()
  }
}

function binomial(n: number, k: number): number {
  let result = 1
  for (let i = 1; i <= k; i++) {
    result = result * (n - k + i) / i
  }
  return result
}

export function chooseEcart(hand: CardId[], size: 6 | 3, level: BotLevel, calledKing?: CardId): CardId[] {
  const legal = hand.filter(isLegalDiscard)
  let discard: CardId[]
  if (legal.length <= size) {
    discard = [...legal]
    const showable = hand
      .filter(card => isRealTrump(card) && !isOudler(card))
      .sort(lowestFirst)
    for (const card of showable) {
      if (discard.length >= size) {
        break
      }
      discard.push(card)
    }
  } else if (level === 'facile' || binomial(legal.length, size) > 120_000) {
    discard = naiveEcart(hand, size)
  } else {
    let best: CardId[] = naiveEcart(hand, size)
    let bestValue = ecartValue(hand, best, calledKing)
    for (const combo of combinations(legal, size)) {
      const value = ecartValue(hand, combo, calledKing)
      if (value > bestValue) {
        best = combo
        bestValue = value
      }
    }
    discard = best
  }
  const validation = validateEcart(hand, discard, size)
  if (!validation.ok) {
    throw new Error(`chooseEcart: failed to build a legal écart (${validation.reason})`)
  }
  return discard
}
