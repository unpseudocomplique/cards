import { describe, expect, it } from 'vitest'
import { assertPlayableTarotDeck } from '../../server/utils/playableDeck'

describe('assertPlayableTarotDeck', () => {
  it('accepts tarot78', () => {
    expect(() => assertPlayableTarotDeck({ type: 'tarot78' })).not.toThrow()
  })

  it('rejects classic52', () => {
    expect(() => assertPlayableTarotDeck({ type: 'classic52' })).toThrow()
  })

  it('rejects tarot56', () => {
    expect(() => assertPlayableTarotDeck({ type: 'tarot56' })).toThrow()
  })
})
