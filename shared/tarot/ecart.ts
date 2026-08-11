import type { CardId } from './types'
import { isOudler, isTrump } from './deck'

export function mergeChienIntoHand(hand: CardId[], chien: CardId[]): CardId[] {
  return [...hand, ...chien]
}

function isKing(card: CardId): boolean {
  return card.endsWith('-k')
}

function isLegalDiscard(card: CardId): boolean {
  return !isTrump(card) && !isKing(card)
}

function multisetContains(hand: CardId[], cards: CardId[]): boolean {
  const counts = new Map<CardId, number>()
  for (const card of hand) {
    counts.set(card, (counts.get(card) ?? 0) + 1)
  }
  for (const card of cards) {
    const remaining = counts.get(card) ?? 0
    if (remaining === 0) {
      return false
    }
    counts.set(card, remaining - 1)
  }
  return true
}

function isShowableTrump(card: CardId): boolean {
  return isTrump(card) && !isOudler(card)
}

export function validateEcart(
  handAfterMerge: CardId[],
  discard: CardId[],
  chienSize: 6 | 3
): { ok: true; shownTrumps: CardId[] } | { ok: false; reason: string } {
  if (discard.length !== chienSize) {
    return {
      ok: false,
      reason: `Discard must contain exactly ${chienSize} cards`,
    }
  }

  if (!multisetContains(handAfterMerge, discard)) {
    return { ok: false, reason: 'Discard contains cards not in hand' }
  }

  for (const card of discard) {
    if (isKing(card)) {
      return { ok: false, reason: 'Cannot discard kings' }
    }
    if (isOudler(card)) {
      return { ok: false, reason: 'Cannot discard oudlers' }
    }
  }

  const legalInHand = handAfterMerge.filter(isLegalDiscard).length
  const legalInDiscard = discard.filter(isLegalDiscard).length
  const requiredLegalInDiscard = Math.min(legalInHand, chienSize)
  const trumpInDiscard = discard.filter(isShowableTrump)

  if (legalInDiscard !== requiredLegalInDiscard) {
    return {
      ok: false,
      reason: 'Must discard all available non-trump, non-king cards before discarding trumps',
    }
  }

  const requiredTrumpDiscards = chienSize - requiredLegalInDiscard
  if (trumpInDiscard.length !== requiredTrumpDiscards) {
    return {
      ok: false,
      reason: 'Trumps may only be discarded when there are not enough legal cards',
    }
  }

  return { ok: true, shownTrumps: trumpInDiscard }
}
