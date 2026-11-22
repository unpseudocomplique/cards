import { describe, expect, it } from 'vitest'
import { seatLabelAnchor, seatTrickCardHeight, seatTrickSpot, trickLayout } from '../../app/utils/seatLayout'

const VIEWS = [
  { width: 390, height: 844, mobile: true },
  { width: 360, height: 740, mobile: true },
  { width: 1280, height: 800, mobile: false },
]

describe('trick cards in front of each player', () => {
  it('uses the numbered row only on landscape phones', () => {
    expect(trickLayout({ width: 844, height: 390 })).toBe('row')
    expect(trickLayout({ width: 390, height: 844 })).toBe('seat')
    expect(trickLayout({ width: 1280, height: 800 })).toBe('seat')
  })

  it.each([3, 4, 5] as const)('%i players: every card fits on screen without hiding another', (count) => {
    for (const view of VIEWS) {
      const h = seatTrickCardHeight(view, count)
      const w = h * 0.62
      const spots = Array.from({ length: count }, (_, seat) => seatTrickSpot(seat, 0, count, view))
      for (const spot of spots) {
        expect(spot.x - w / 2).toBeGreaterThanOrEqual(0)
        expect(spot.x + w / 2).toBeLessThanOrEqual(view.width)
      }
      for (let a = 0; a < count; a++) {
        for (let b = a + 1; b < count; b++) {
          const dx = Math.abs(spots[a]!.x - spots[b]!.x)
          const dy = Math.abs(spots[a]!.y - spots[b]!.y)
          // Small overlaps of tilted corners are fine, not a hidden index.
          expect(dx >= w * 0.8 || dy >= h * 0.8).toBe(true)
        }
      }
    }
  })

  it('puts each card on its player\'s side: local at the bottom, left seats on the left', () => {
    const view = VIEWS[0]!
    const local = seatTrickSpot(0, 0, 5, view)
    const left = seatTrickSpot(1, 0, 5, view)
    const right = seatTrickSpot(4, 0, 5, view)
    const top = seatTrickSpot(2, 0, 5, view)
    expect(local.y).toBeGreaterThan(top.y)
    expect(left.x).toBeLessThan(local.x)
    expect(right.x).toBeGreaterThan(local.x)
  })
})

describe('name tags on landscape phones', () => {
  it('keep each player\'s tag on their own side of the trick', () => {
    const view = { width: 844, height: 390, mobile: true }
    // Seat 2 sits at the far left of the table, seat 3 at the far right (5 players, local 0).
    const leftTag = seatLabelAnchor(2, 0, 5, view)
    const rightTag = seatLabelAnchor(3, 0, 5, view)
    expect(leftTag.x).toBeLessThan(view.width / 2)
    expect(rightTag.x).toBeGreaterThan(view.width / 2)
  })
})
