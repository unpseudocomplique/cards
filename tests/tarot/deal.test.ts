import { describe, expect, it } from 'vitest'
import { buildTarot78Deck } from '../../shared/tarot/deck'
import {
  dealFromShuffled,
  dealHands,
  detectPetitSecSeats,
  shuffleDeck,
} from '../../shared/tarot/deal'
import type { CardId } from '../../shared/tarot/types'

const fixedRng = (() => {
  let i = 0
  return () => {
    i += 1
    return (i % 1000) / 1000
  }
})()

describe('dealHands', () => {
  it('deals 4p as 18/18/18/18 + chien 6', () => {
    const r = dealHands(4, fixedRng)
    expect(r.hands.every(h => h.length === 18)).toBe(true)
    expect(r.chien).toHaveLength(6)
    const all = [...r.hands.flat(), ...r.chien]
    expect(new Set(all).size).toBe(78)
  })

  it('deals 3p as 24 each + chien 6', () => {
    const r = dealHands(3, fixedRng)
    expect(r.hands.every(h => h.length === 24)).toBe(true)
    expect(r.chien).toHaveLength(6)
  })

  it('deals 5p as 15 each + chien 3', () => {
    const r = dealHands(5, fixedRng)
    expect(r.hands.every(h => h.length === 15)).toBe(true)
    expect(r.chien).toHaveLength(3)
  })

  it('never puts shuffled deck indices 0 or 77 into chien', () => {
    for (const playerCount of [3, 4, 5] as const) {
      const shuffled = shuffleDeck(buildTarot78Deck(), fixedRng)
      const first = shuffled[0]!
      const last = shuffled[77]!
      const r = dealFromShuffled(playerCount, shuffled)
      expect(r.chien).not.toContain(first)
      expect(r.chien).not.toContain(last)
    }
  })
})

describe('detectPetitSecSeats', () => {
  it('flags seat with only trump-1 and no excuse', () => {
    const hands: CardId[][] = [
      ['trump-1' as CardId, 'hearts-1' as CardId, 'hearts-2' as CardId],
      ['trump-1' as CardId, 'trump-2' as CardId],
      ['hearts-k' as CardId],
    ]
    expect(detectPetitSecSeats(hands)).toEqual([0])
  })

  it('does not flag excuse, extra trumps, or no trumps', () => {
    const hands: CardId[][] = [
      ['trump-1' as CardId, 'excuse' as CardId],
      ['trump-1' as CardId, 'trump-21' as CardId],
      ['hearts-1' as CardId, 'diamonds-2' as CardId],
    ]
    expect(detectPetitSecSeats(hands)).toEqual([])
  })
})
