import { describe, expect, it } from 'vitest'
import { buildTarot78Deck, cardPoints, isOudler } from '../../shared/tarot/deck'

describe('deck', () => {
  it('has 78 unique cards', () => {
    const deck = buildTarot78Deck()
    expect(deck).toHaveLength(78)
    expect(new Set(deck).size).toBe(78)
  })

  it('scores oudlers and kings at 4.5', () => {
    expect(cardPoints('trump-21')).toBe(4.5)
    expect(cardPoints('trump-1')).toBe(4.5)
    expect(cardPoints('excuse')).toBe(4.5)
    expect(cardPoints('hearts-k')).toBe(4.5)
    expect(isOudler('excuse')).toBe(true)
  })
})
