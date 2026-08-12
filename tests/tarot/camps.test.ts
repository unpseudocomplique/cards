import { describe, expect, it } from 'vitest'
import { isPetitStolen, sameCamp } from '../../shared/tarot/camps'
import type { CardId } from '../../shared/tarot/types'

const c = (id: string) => id as CardId

describe('isPetitStolen', () => {
  const fourPlayer = {
    playerCount: 4 as const,
    bid: { seat: 0 },
  }

  it('detects petit taken by the opposite camp', () => {
    const trick = [
      { seat: 0, card: c('trump-1') },
      { seat: 1, card: c('trump-14') },
      { seat: 2, card: c('hearts-k') },
      { seat: 3, card: c('spades-1') },
    ]
    expect(isPetitStolen(fourPlayer, trick, 1)).toEqual({
      stolen: true,
      victimSeat: 0,
      thiefSeat: 1,
    })
  })

  it('is not a steal when same camp wins the petit', () => {
    const fivePlayer = {
      playerCount: 5 as const,
      bid: { seat: 0 },
      partnerSeat: 2,
    }
    const trick = [
      { seat: 0, card: c('trump-1') },
      { seat: 2, card: c('trump-20') },
    ]
    expect(sameCamp(fivePlayer, 0, 2)).toBe(true)
    expect(isPetitStolen(fivePlayer, trick, 2).stolen).toBe(false)
  })
})
