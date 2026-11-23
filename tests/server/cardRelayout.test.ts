import { describe, expect, it } from 'vitest'
import { CARD_FORMATS } from '../../shared/utils/printSpec'
import { isFaceLayoutStale } from '../../server/utils/cardRelayout'

describe('card relayout', () => {
  it('redraws tarot faces drawn before the one-line index', () => {
    expect(isFaceLayoutStale({ format: 'tarot' })).toBe(true)
    expect(isFaceLayoutStale({ format: 'tarot', layoutVersion: 1 })).toBe(true)
    expect(isFaceLayoutStale({ format: 'tarot', layoutVersion: CARD_FORMATS.tarot.layoutVersion })).toBe(false)
  })

  it('leaves poker faces alone (their layout did not change)', () => {
    expect(isFaceLayoutStale({ format: 'poker' })).toBe(false)
    expect(isFaceLayoutStale({})).toBe(false)
  })
})
