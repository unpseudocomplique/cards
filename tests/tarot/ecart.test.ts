import { describe, expect, it } from 'vitest'
import { mergeChienIntoHand, validateEcart } from '../../shared/tarot/ecart'
import type { CardId } from '../../shared/tarot/types'

const c = (id: string) => id as CardId

describe('mergeChienIntoHand', () => {
  it('concatenates hand and chien', () => {
    const hand = [c('hearts-1'), c('hearts-2')]
    const chien = [c('clubs-3'), c('diamonds-4')]
    expect(mergeChienIntoHand(hand, chien)).toEqual([
      c('hearts-1'),
      c('hearts-2'),
      c('clubs-3'),
      c('diamonds-4'),
    ])
  })
})

describe('validateEcart', () => {
  it('rejects discarding a king', () => {
    const hand = [
      c('hearts-k'),
      c('hearts-1'),
      c('hearts-2'),
      c('hearts-3'),
      c('hearts-4'),
      c('hearts-5'),
      c('hearts-6'),
    ]
    const discard = [
      c('hearts-k'),
      c('hearts-1'),
      c('hearts-2'),
      c('hearts-3'),
      c('hearts-4'),
      c('hearts-5'),
    ]
    const result = validateEcart(hand, discard, 6)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/king/i)
    }
  })

  it('rejects discarding an oudler', () => {
    const hand = [
      c('trump-1'),
      c('hearts-1'),
      c('hearts-2'),
      c('hearts-3'),
      c('hearts-4'),
      c('hearts-5'),
      c('hearts-6'),
    ]
    const discard = [
      c('trump-1'),
      c('hearts-1'),
      c('hearts-2'),
      c('hearts-3'),
      c('hearts-4'),
      c('hearts-5'),
    ]
    const result = validateEcart(hand, discard, 6)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/oudler/i)
    }
  })

  it('accepts a valid 6-card ecart of suit non-kings', () => {
    const hand = [
      c('hearts-1'),
      c('hearts-2'),
      c('hearts-3'),
      c('hearts-4'),
      c('hearts-5'),
      c('hearts-6'),
      c('hearts-7'),
      c('clubs-1'),
    ]
    const discard = [
      c('hearts-1'),
      c('hearts-2'),
      c('hearts-3'),
      c('hearts-4'),
      c('hearts-5'),
      c('hearts-6'),
    ]
    const result = validateEcart(hand, discard, 6)
    expect(result).toEqual({ ok: true, shownTrumps: [] })
  })

  it('requires shown trumps when forced to discard trumps', () => {
    const hand = [
      c('hearts-1'),
      c('hearts-2'),
      c('trump-5'),
      c('trump-10'),
      c('trump-15'),
      c('trump-20'),
      c('hearts-k'),
      c('trump-21'),
    ]
    const discard = [
      c('hearts-1'),
      c('hearts-2'),
      c('trump-5'),
      c('trump-10'),
      c('trump-15'),
      c('trump-20'),
    ]
    const result = validateEcart(hand, discard, 6)
    expect(result).toEqual({
      ok: true,
      shownTrumps: [c('trump-5'), c('trump-10'), c('trump-15'), c('trump-20')],
    })
  })
})
