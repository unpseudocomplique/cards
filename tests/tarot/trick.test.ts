import { describe, expect, it } from 'vitest'
import { compareSuitRank, resolveTrick, trickLedSuit, trumpValue } from '../../shared/tarot/trick'
import type { CardId } from '../../shared/tarot/types'

const c = (id: string) => id as CardId

describe('trumpValue', () => {
  it('returns trump rank for trumps and null for excuse', () => {
    expect(trumpValue(c('trump-21'))).toBe(21)
    expect(trumpValue(c('trump-1'))).toBe(1)
    expect(trumpValue(c('excuse'))).toBeNull()
    expect(trumpValue(c('hearts-k'))).toBeNull()
  })
})

describe('compareSuitRank', () => {
  it('orders K > Q > C > J > 10 > … > 1', () => {
    expect(compareSuitRank(c('hearts-k'), c('hearts-q'))).toBeGreaterThan(0)
    expect(compareSuitRank(c('hearts-q'), c('hearts-c'))).toBeGreaterThan(0)
    expect(compareSuitRank(c('hearts-c'), c('hearts-j'))).toBeGreaterThan(0)
    expect(compareSuitRank(c('hearts-j'), c('hearts-10'))).toBeGreaterThan(0)
    expect(compareSuitRank(c('hearts-10'), c('hearts-1'))).toBeGreaterThan(0)
    expect(compareSuitRank(c('hearts-1'), c('hearts-k'))).toBeLessThan(0)
  })
})

describe('trickLedSuit', () => {
  it('returns null for empty trick or excuse-only lead', () => {
    expect(trickLedSuit([])).toBeNull()
    expect(trickLedSuit([{ seat: 0, card: c('excuse') }])).toBeNull()
  })

  it('uses second non-excuse card when excuse leads', () => {
    const trick = [
      { seat: 0, card: c('excuse') },
      { seat: 1, card: c('diamonds-j') },
    ]
    expect(trickLedSuit(trick)).toBe('diamonds')
  })

  it('returns led suit for normal lead', () => {
    expect(trickLedSuit([{ seat: 0, card: c('hearts-k') }])).toBe('hearts')
    expect(trickLedSuit([{ seat: 0, card: c('trump-8') }])).toBe('trumps')
  })
})

describe('resolveTrick', () => {
  it('picks highest card of led suit when no trump played', () => {
    const cards = [
      { seat: 0, card: c('hearts-7') },
      { seat: 1, card: c('hearts-k') },
      { seat: 2, card: c('hearts-2') },
    ]
    expect(resolveTrick(cards)).toEqual({ winnerSeat: 1 })
  })

  it('picks highest trump when any trump is played', () => {
    const cards = [
      { seat: 0, card: c('hearts-k') },
      { seat: 1, card: c('trump-5') },
      { seat: 2, card: c('trump-18') },
      { seat: 3, card: c('trump-3') },
    ]
    expect(resolveTrick(cards)).toEqual({ winnerSeat: 2 })
  })

  it('never awards trick to excuse', () => {
    const cards = [
      { seat: 0, card: c('excuse') },
      { seat: 1, card: c('hearts-2') },
      { seat: 2, card: c('hearts-5') },
    ]
    expect(resolveTrick(cards)).toEqual({ winnerSeat: 2 })
  })

  it('uses second card suit when excuse leads', () => {
    const cards = [
      { seat: 0, card: c('excuse') },
      { seat: 1, card: c('diamonds-j') },
      { seat: 2, card: c('diamonds-k') },
    ]
    expect(resolveTrick(cards)).toEqual({ winnerSeat: 2 })
  })

  it('ignores excuse when comparing trumps', () => {
    const cards = [
      { seat: 0, card: c('trump-10') },
      { seat: 1, card: c('excuse') },
      { seat: 2, card: c('trump-4') },
    ]
    expect(resolveTrick(cards)).toEqual({ winnerSeat: 0 })
  })

  it('resolves trump-led trick by highest trump', () => {
    const cards = [
      { seat: 0, card: c('trump-12') },
      { seat: 1, card: c('trump-20') },
      { seat: 2, card: c('trump-3') },
    ]
    expect(resolveTrick(cards)).toEqual({ winnerSeat: 1 })
  })
})
