import { describe, expect, it } from 'vitest'
import { cardLabelFr, describeTrick } from '../../shared/tarot/trickSummary'
import type { PublicGameView } from '../../shared/tarot/types'

function c(id: string) {
  return id as PublicGameView['trick'][number]['card']
}

function baseView(overrides: Partial<PublicGameView> = {}): PublicGameView {
  return {
    phase: 'Trick',
    version: 1,
    playerCount: 4,
    endMode: 'deals',
    endValue: 1,
    code: 'TEST',
    deckId: 'deck',
    dealerSeat: 0,
    currentSeat: 0,
    seats: [
      { seatId: 0, userId: 'u0', name: 'Alice', connected: true, controlledBy: 'human' },
      { seatId: 1, userId: 'u1', name: 'Bob', connected: true, controlledBy: 'bot' },
      { seatId: 2, userId: 'u2', name: 'Carla', connected: true, controlledBy: 'bot' },
      { seatId: 3, userId: 'u3', name: 'Dan', connected: true, controlledBy: 'bot' },
    ],
    handCounts: [10, 10, 10, 10],
    trick: [],
    chienRevealed: null,
    ecartCount: 0,
    bid: { seat: 0, contract: 'prise' },
    bidSpoken: [],
    partnerSeat: undefined,
    calledKing: null,
    scores: [0, 0, 0, 0],
    dealIndex: 1,
    pilesAttackCount: 0,
    pilesDefenseCount: 0,
    tricksWonBySeat: [0, 0, 0, 0],
    lastTrick: null,
    lastTrickWinnerSeat: null,
    ...overrides,
  } as PublicGameView
}

describe('cardLabelFr', () => {
  it('labels French tarot cards', () => {
    expect(cardLabelFr(c('excuse'))).toBe("l'Excuse")
    expect(cardLabelFr(c('trump-1'))).toBe('le Petit')
    expect(cardLabelFr(c('trump-21'))).toBe('le 21')
    expect(cardLabelFr(c('hearts-k'))).toBe('Roi de cœur')
    expect(cardLabelFr(c('spades-1'))).toBe('As de pique')
  })
})

describe('describeTrick', () => {
  it('explains a plain suit winner', () => {
    const summary = describeTrick(baseView(), [
      { seat: 0, card: c('hearts-7') },
      { seat: 1, card: c('hearts-k') },
      { seat: 2, card: c('hearts-2') },
      { seat: 3, card: c('hearts-9') },
    ])
    expect(summary.winnerSeat).toBe(1)
    expect(summary.title).toBe('Pli pour Bob')
    expect(summary.subtitle).toContain('cœur')
    expect(summary.subtitle).toContain('Roi de cœur')
  })

  it('explains a cut with trump', () => {
    const summary = describeTrick(baseView(), [
      { seat: 0, card: c('diamonds-10') },
      { seat: 1, card: c('diamonds-k') },
      { seat: 2, card: c('trump-4') },
      { seat: 3, card: c('diamonds-2') },
    ])
    expect(summary.winnerSeat).toBe(2)
    expect(summary.subtitle).toContain('coupe')
    expect(summary.subtitle).toContain('atout 4')
  })

  it('flags petit stolen by the other camp', () => {
    const summary = describeTrick(baseView(), [
      { seat: 0, card: c('trump-1') },
      { seat: 1, card: c('trump-14') },
      { seat: 2, card: c('trump-3') },
      { seat: 3, card: c('trump-5') },
    ])
    expect(summary.winnerSeat).toBe(1)
    expect(summary.accent).toBe('rose')
    expect(summary.details.some(line => line.includes('vole le Petit'))).toBe(true)
  })
})
