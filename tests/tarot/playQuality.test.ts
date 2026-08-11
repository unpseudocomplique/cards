import { describe, expect, it } from 'vitest'
import { detectPlayQualityProfile, downgradeProfile, settingsForProfile } from '../../app/composables/usePlayQuality'
import { placeholderColor, placeholderLabel } from '../../app/utils/cardPlaceholderTexture'

describe('play quality', () => {
  it('picks low for few cores or software GL', () => {
    expect(detectPlayQualityProfile({ hardwareConcurrency: 4 })).toBe('low')
    expect(detectPlayQualityProfile({ hardwareConcurrency: 8, webglRenderer: 'SwiftShader' })).toBe('low')
  })

  it('picks medium for touch devices', () => {
    expect(detectPlayQualityProfile({ hardwareConcurrency: 8, maxTouchPoints: 5 })).toBe('medium')
  })

  it('downgrades once step', () => {
    expect(downgradeProfile('high')).toBe('medium')
    expect(downgradeProfile('medium')).toBe('low')
    expect(downgradeProfile('low')).toBe('low')
  })

  it('exposes dpr caps', () => {
    expect(settingsForProfile('high').dprCap).toBe(1.5)
    expect(settingsForProfile('low').maxTex).toBe(256)
  })
})

describe('placeholders', () => {
  it('labels kings and trumps', () => {
    expect(placeholderLabel('hearts-k')).toContain('K')
    expect(placeholderLabel('trump-21')).toBe('21')
    expect(placeholderColor('hearts-k')).toMatch(/#/)
  })
})
