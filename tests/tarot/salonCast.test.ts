import { Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import { SALON_CHARACTERS } from '../../shared/play/salonCharacters'
import { SALON_SCULPT_SPECS } from '../../app/utils/salonSculpt/specs'
import { createSalonCastModel, SALON_CAST_FACTORIES } from '../../app/components/play/tres/salon-cast'

describe('salon cast factories', () => {
  it('registers exactly the 10 cast ids', () => {
    const ids = SALON_CHARACTERS.map(c => c.id).sort()
    expect(Object.keys(SALON_CAST_FACTORIES).sort()).toEqual(ids)
    expect(Object.keys(SALON_SCULPT_SPECS).sort()).toEqual(ids)
  })

  it('each sculpt has unique hair/outfit signature', () => {
    const signatures = SALON_CHARACTERS.map((c) => {
      const s = SALON_SCULPT_SPECS[c.id]!
      return `${s.hairStyle}|${s.outfit}|${s.facialHair}|${s.glasses}|${s.bowTie}|${s.build}`
    })
    expect(new Set(signatures).size).toBe(signatures.length)
  })

  it('builds a seated sculpted figure without photo projection', () => {
    for (const character of SALON_CHARACTERS) {
      const root = createSalonCastModel(character.id)
      expect(root.name).toBe(`salon-${character.id}`)
      expect(root.getObjectByName('head')).toBeTruthy()
      expect(root.getObjectByName('thigh-l')).toBeTruthy()
      expect(root.getObjectByName('shin-l')).toBeTruthy()
      expect(root.getObjectByName('foot-l')).toBeTruthy()
      expect(root.getObjectByName('upper-arm-l')).toBeTruthy()
      expect(root.userData.sculptRuntime.likeness.mode).toBe('authored-volumes')
      expect(root.userData.sculptRuntime.likeness.source).toBe(character.portraitPath)

      let mapped = 0
      let meshCount = 0
      root.traverse((obj) => {
        if (obj instanceof Mesh) {
          meshCount++
          const material = Array.isArray(obj.material) ? obj.material[0] : obj.material
          if (material && 'map' in material && material.map) {
            mapped++
          }
        }
      })
      expect(mapped).toBe(0)
      expect(meshCount).toBeGreaterThan(30)
      root.userData.sculptRuntime.dispose()
    }
  })

  it('gives Aurélien glasses and a beard', () => {
    const root = createSalonCastModel('aurelien')
    expect(root.getObjectByName('glasses-l')).toBeTruthy()
    expect(root.getObjectByName('hair')).toBeTruthy()
    root.userData.sculptRuntime.dispose()
  })
})
