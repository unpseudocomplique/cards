import { describe, expect, it } from 'vitest'
import { SALON_CHARACTERS } from '../../shared/play/salonCharacters'
import { SALON_SCULPT_SPECS } from '../../app/utils/salonSculpt/specs'
import { SALON_CAST_FACTORIES } from '../../app/components/play/tres/salon-cast'

describe('salon cast factories', () => {
  it('registers exactly the 10 cast ids', () => {
    const ids = SALON_CHARACTERS.map(c => c.id).sort()
    expect(Object.keys(SALON_CAST_FACTORIES).sort()).toEqual(ids)
    expect(Object.keys(SALON_SCULPT_SPECS).sort()).toEqual(ids)
  })

  it('each sculpt has unique hair/outfit signature', () => {
    const signatures = SALON_CHARACTERS.map((c) => {
      const s = SALON_SCULPT_SPECS[c.id]!
      return `${s.hairStyle}|${s.outfit}|${s.accessory}|${s.build}`
    })
    expect(new Set(signatures).size).toBe(signatures.length)
  })
})
