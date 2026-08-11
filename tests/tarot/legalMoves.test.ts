import { describe, expect, it } from 'vitest'
import { legalMoves } from '../../shared/tarot/legalMoves'
import type { CardId } from '../../shared/tarot/types'

const c = (id: string) => id as CardId

describe('legalMoves', () => {
  it('allows any card when leading an empty trick', () => {
    const hand = [c('hearts-k'), c('trump-21'), c('excuse')]
    expect(legalMoves(hand, [], null)).toEqual(hand)
  })

  it('allows any card when excuse is the sole card in the trick', () => {
    const hand = [c('hearts-5'), c('clubs-k'), c('trump-3')]
    const trick = [{ seat: 0, card: c('excuse') }]
    expect(legalMoves(hand, trick, null)).toEqual(hand)
  })

  it('requires following the led suit when able', () => {
    const hand = [c('hearts-k'), c('hearts-2'), c('clubs-5'), c('trump-10')]
    const trick = [{ seat: 0, card: c('hearts-7') }]
    const moves = legalMoves(hand, trick, 'hearts')
    expect(moves).toContain(c('hearts-k'))
    expect(moves).toContain(c('hearts-2'))
    expect(moves).not.toContain(c('clubs-5'))
    expect(moves).not.toContain(c('trump-10'))
  })

  it('always includes excuse even when suit must be followed', () => {
    const hand = [c('hearts-k'), c('excuse')]
    const trick = [{ seat: 0, card: c('hearts-7') }]
    const moves = legalMoves(hand, trick, 'hearts')
    expect(moves).toEqual(expect.arrayContaining([c('hearts-k'), c('excuse')]))
    expect(moves).toHaveLength(2)
  })

  it('requires trump when void in led suit and holding trumps', () => {
    const hand = [c('clubs-5'), c('trump-5'), c('trump-15')]
    const trick = [{ seat: 0, card: c('hearts-k') }]
    const moves = legalMoves(hand, trick, 'hearts')
    expect(moves).toContain(c('trump-5'))
    expect(moves).toContain(c('trump-15'))
    expect(moves).not.toContain(c('clubs-5'))
  })

  it('requires overtrump when a trump is already in the trick', () => {
    const hand = [c('trump-3'), c('trump-10'), c('trump-20')]
    const trick = [
      { seat: 0, card: c('hearts-k') },
      { seat: 1, card: c('trump-7') },
    ]
    const moves = legalMoves(hand, trick, 'hearts')
    expect(moves).toContain(c('trump-10'))
    expect(moves).toContain(c('trump-20'))
    expect(moves).not.toContain(c('trump-3'))
  })

  it('allows any trump (pisser) when unable to overtrump', () => {
    const hand = [c('trump-3'), c('trump-5')]
    const trick = [
      { seat: 0, card: c('hearts-k') },
      { seat: 1, card: c('trump-15') },
    ]
    const moves = legalMoves(hand, trick, 'hearts')
    expect(moves).toContain(c('trump-3'))
    expect(moves).toContain(c('trump-5'))
  })

  it('requires overtrump on trump lead when able', () => {
    const hand = [c('trump-3'), c('trump-12'), c('hearts-k')]
    const trick = [{ seat: 0, card: c('trump-8') }]
    const moves = legalMoves(hand, trick, 'trumps')
    expect(moves).toContain(c('trump-12'))
    expect(moves).not.toContain(c('trump-3'))
    expect(moves).not.toContain(c('hearts-k'))
  })

  it('allows any card when void in suit and void in trump', () => {
    const hand = [c('clubs-5'), c('diamonds-j')]
    const trick = [{ seat: 0, card: c('hearts-k') }]
    const moves = legalMoves(hand, trick, 'hearts')
    expect(moves).toEqual(hand)
  })

  it('includes excuse when void and must trump', () => {
    const hand = [c('trump-5'), c('excuse')]
    const trick = [{ seat: 0, card: c('hearts-k') }]
    const moves = legalMoves(hand, trick, 'hearts')
    expect(moves).toContain(c('trump-5'))
    expect(moves).toContain(c('excuse'))
  })
})
