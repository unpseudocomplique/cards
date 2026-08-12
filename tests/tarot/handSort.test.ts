import { describe, expect, it } from 'vitest'
import { sortHand } from '../../shared/tarot/handSort'
import type { CardId } from '../../shared/tarot/types'

const c = (id: string) => id as CardId

describe('sortHand', () => {
  it('orders trumps 21→1 then Excuse, then suits high-to-low', () => {
    const hand = [
      c('hearts-1'),
      c('trump-1'),
      c('spades-k'),
      c('excuse'),
      c('trump-21'),
      c('trump-4'),
      c('hearts-k'),
      c('diamonds-q'),
      c('spades-8'),
      c('spades-10'),
      c('spades-9'),
    ]
    expect(sortHand(hand)).toEqual([
      c('trump-21'),
      c('trump-4'),
      c('trump-1'),
      c('excuse'),
      c('spades-k'),
      c('spades-10'),
      c('spades-9'),
      c('spades-8'),
      c('hearts-k'),
      c('hearts-1'),
      c('diamonds-q'),
    ])
  })

  it('keeps suit ranks strictly Roi→As', () => {
    const hand = [
      c('clubs-8'),
      c('clubs-k'),
      c('clubs-1'),
      c('clubs-j'),
      c('clubs-10'),
      c('clubs-c'),
      c('clubs-q'),
      c('clubs-9'),
    ]
    expect(sortHand(hand)).toEqual([
      c('clubs-k'),
      c('clubs-q'),
      c('clubs-c'),
      c('clubs-j'),
      c('clubs-10'),
      c('clubs-9'),
      c('clubs-8'),
      c('clubs-1'),
    ])
  })
})
