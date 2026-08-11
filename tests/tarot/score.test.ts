import { describe, expect, it } from 'vitest'
import { buildTarot78Deck } from '../../shared/tarot/deck'
import type { CardId } from '../../shared/tarot/types'
import {
  computeDealScore,
  countCardPoints,
  requiredPoints,
} from '../../shared/tarot/score'

function asCard(id: string): CardId {
  return id as CardId
}

describe('requiredPoints', () => {
  it.each([
    [0, 56],
    [1, 51],
    [2, 41],
    [3, 36],
  ] as const)('requires %i oudlers → %i points', (oudlers, points) => {
    expect(requiredPoints(oudlers)).toBe(points)
  })
})

describe('countCardPoints', () => {
  it('totals 91 for the full deck (pair method)', () => {
    expect(countCardPoints(buildTarot78Deck())).toBe(91)
  })

  it('pairs highest with lowest values', () => {
    // king (4.5) + pip (0.5) → floor(5) = 5
    expect(countCardPoints([asCard('hearts-k'), asCard('hearts-2')])).toBe(5)
  })
})

describe('computeDealScore', () => {
  /** 49 pts with 2 oudlers — FFT garde +8 example hand. */
  const taker49TwoBouts: CardId[] = [
    asCard('trump-21'),
    asCard('trump-1'),
    asCard('hearts-k'),
    asCard('diamonds-k'),
    asCard('clubs-k'),
    asCard('spades-k'),
    asCard('hearts-q'),
    asCard('diamonds-q'),
    asCard('clubs-q'),
    asCard('spades-q'),
    asCard('diamonds-c'),
    asCard('spades-c'),
    asCard('diamonds-j'),
    asCard('spades-j'),
  ]

  /** Minimum winning attack: 41 pts with 2 oudlers. */
  const takerWinsTwoBouts: CardId[] = [
    asCard('trump-21'),
    asCard('trump-1'),
    asCard('hearts-k'),
    asCard('diamonds-k'),
    asCard('clubs-k'),
    asCard('spades-k'),
    asCard('hearts-q'),
    asCard('diamonds-q'),
    asCard('clubs-q'),
    asCard('spades-q'),
  ]

  it('validates FFT garde example: 49 pts, 2 bouts, diff +8 → S=106', () => {
    expect(countCardPoints(taker49TwoBouts)).toBe(49)

    const deltas = computeDealScore({
      playerCount: 4,
      contract: 'garde',
      takerSeat: 0,
      takerCards: taker49TwoBouts,
      defenseCards: [],
      poigneePrime: 20,
      petitAuBoutCamp: 'attack',
    })

    expect(deltas[1]).toBe(-106)
    expect(deltas[2]).toBe(-106)
    expect(deltas[3]).toBe(-106)
    expect(deltas[0]).toBe(318)
    expect(Object.values(deltas).reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('zero-sums for 3p and 5p', () => {
    const base = {
      contract: 'prise' as const,
      takerCards: takerWinsTwoBouts,
      defenseCards: [] as CardId[],
    }

    for (const playerCount of [3, 4, 5] as const) {
      const deltas = computeDealScore({
        ...base,
        playerCount,
        takerSeat: 0,
        partnerSeat: playerCount === 5 ? 1 : undefined,
      })
      expect(Object.values(deltas).reduce((a, b) => a + b, 0)).toBe(0)
    }
  })

  it('does not multiply poignée by contract', () => {
    const withPoignee = computeDealScore({
      playerCount: 4,
      contract: 'garde',
      takerSeat: 0,
      takerCards: takerWinsTwoBouts,
      defenseCards: [],
      poigneePrime: 20,
    })
    const without = computeDealScore({
      playerCount: 4,
      contract: 'garde',
      takerSeat: 0,
      takerCards: takerWinsTwoBouts,
      defenseCards: [],
    })
    expect(withPoignee[0] - without[0]).toBe(3 * 20)
  })

  it('multiplies petit au bout by contract', () => {
    const prise = computeDealScore({
      playerCount: 4,
      contract: 'prise',
      takerSeat: 0,
      takerCards: takerWinsTwoBouts,
      defenseCards: [],
      petitAuBoutCamp: 'attack',
    })
    const priseNoPetit = computeDealScore({
      playerCount: 4,
      contract: 'prise',
      takerSeat: 0,
      takerCards: takerWinsTwoBouts,
      defenseCards: [],
    })
    const garde = computeDealScore({
      playerCount: 4,
      contract: 'garde',
      takerSeat: 0,
      takerCards: takerWinsTwoBouts,
      defenseCards: [],
      petitAuBoutCamp: 'attack',
    })
    const gardeNoPetit = computeDealScore({
      playerCount: 4,
      contract: 'garde',
      takerSeat: 0,
      takerCards: takerWinsTwoBouts,
      defenseCards: [],
    })
    expect(prise[0] - priseNoPetit[0]).toBe(3 * 10)
    expect(garde[0] - gardeNoPetit[0]).toBe(3 * 20)
  })

  it('flips contract unit sign when taker fails', () => {
    const failCards = [asCard('hearts-2'), asCard('hearts-3')]
    const deltas = computeDealScore({
      playerCount: 4,
      contract: 'prise',
      takerSeat: 0,
      takerCards: failCards,
      defenseCards: [],
    })
    expect(deltas[0]).toBeLessThan(0)
    expect(deltas[1]).toBeGreaterThan(0)
  })

  it('awards poignée to deal winner camp', () => {
    const win = computeDealScore({
      playerCount: 4,
      contract: 'prise',
      takerSeat: 0,
      takerCards: takerWinsTwoBouts,
      defenseCards: [],
      poigneePrime: 20,
    })
    const fail = computeDealScore({
      playerCount: 4,
      contract: 'prise',
      takerSeat: 0,
      takerCards: [asCard('hearts-2')],
      defenseCards: [],
      poigneePrime: 20,
    })
    expect(win[0]).toBeGreaterThan(fail[0])
  })

  it.each([
    ['announced_made', 400],
    ['unannounced_made', 200],
    ['announced_failed', -200],
  ] as const)('chelem %s adjusts S by %i (4p taker share)', (chelem, prime) => {
    const cards = takerWinsTwoBouts
    const withChelem = computeDealScore({
      playerCount: 4,
      contract: 'prise',
      takerSeat: 0,
      takerCards: cards,
      defenseCards: [],
      chelem,
    })
    const without = computeDealScore({
      playerCount: 4,
      contract: 'prise',
      takerSeat: 0,
      takerCards: cards,
      defenseCards: [],
    })
    expect(withChelem[0] - without[0]).toBe(3 * prime)
  })

  it('chelem defense adds 200 per defender on top of normal', () => {
    const cards = takerWinsTwoBouts
    const withDefenseChelem = computeDealScore({
      playerCount: 4,
      contract: 'prise',
      takerSeat: 0,
      takerCards: cards,
      defenseCards: [],
      chelem: 'defense',
    })
    const normal = computeDealScore({
      playerCount: 4,
      contract: 'prise',
      takerSeat: 0,
      takerCards: cards,
      defenseCards: [],
    })
    // +200 per defender in settlement → taker −600 (4p)
    expect(withDefenseChelem[0] - normal[0]).toBe(-3 * 200)
    expect(withDefenseChelem[1] - normal[1]).toBe(200)
  })

  it('5p with partner splits 2:1 attack shares', () => {
    const deltas = computeDealScore({
      playerCount: 5,
      contract: 'prise',
      takerSeat: 0,
      partnerSeat: 1,
      takerCards: takerWinsTwoBouts,
      defenseCards: [],
    })
    expect(deltas[0]).toBe(-2 * deltas[2])
    expect(deltas[1]).toBe(-deltas[2])
    expect(Object.values(deltas).reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('announced_failed chelem penalizes taker even when point contract fails', () => {
    const failCards = [asCard('hearts-2'), asCard('hearts-3')]
    const without = computeDealScore({
      playerCount: 4,
      contract: 'prise',
      takerSeat: 0,
      takerCards: failCards,
      defenseCards: [],
    })
    const withFailedChelem = computeDealScore({
      playerCount: 4,
      contract: 'prise',
      takerSeat: 0,
      takerCards: failCards,
      defenseCards: [],
      chelem: 'announced_failed',
    })
    expect(withFailedChelem[0]).toBeLessThan(without[0])
    expect(withFailedChelem[0] - without[0]).toBe(-3 * 200)
  })

  it('attack petit au bout credits attack even when point contract fails', () => {
    const failCards = [asCard('hearts-2'), asCard('hearts-3')]
    const without = computeDealScore({
      playerCount: 4,
      contract: 'garde',
      takerSeat: 0,
      takerCards: failCards,
      defenseCards: [],
    })
    const withPetit = computeDealScore({
      playerCount: 4,
      contract: 'garde',
      takerSeat: 0,
      takerCards: failCards,
      defenseCards: [],
      petitAuBoutCamp: 'attack',
    })
    expect(withPetit[0]).toBeGreaterThan(without[0])
    expect(withPetit[0] - without[0]).toBe(3 * 10 * 2)
  })
})
