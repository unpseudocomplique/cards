import { describe, expect, it } from 'vitest'
import { dealHands } from '../../shared/tarot/deal'

const fixedRng = (() => {
  let i = 0
  return () => {
    i += 1
    return (i % 1000) / 1000
  }
})()

describe('dealHands', () => {
  it('deals 4p as 18/18/18/18 + chien 6', () => {
    const r = dealHands(4, fixedRng)
    expect(r.hands.every(h => h.length === 18)).toBe(true)
    expect(r.chien).toHaveLength(6)
    const all = [...r.hands.flat(), ...r.chien]
    expect(new Set(all).size).toBe(78)
  })

  it('deals 3p as 24 each + chien 6', () => {
    const r = dealHands(3, fixedRng)
    expect(r.hands.every(h => h.length === 24)).toBe(true)
    expect(r.chien).toHaveLength(6)
  })

  it('deals 5p as 15 each + chien 3', () => {
    const r = dealHands(5, fixedRng)
    expect(r.hands.every(h => h.length === 15)).toBe(true)
    expect(r.chien).toHaveLength(3)
  })
})
