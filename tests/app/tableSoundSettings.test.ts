import { describe, expect, it } from 'vitest'
import { DEFAULT_SOUND_SETTINGS, parseSoundSettings } from '../../app/composables/useTableSound'

describe('parseSoundSettings', () => {
  it('falls back to the defaults when nothing is saved or the value is broken', () => {
    expect(parseSoundSettings(null)).toEqual(DEFAULT_SOUND_SETTINGS)
    expect(parseSoundSettings('not json')).toEqual(DEFAULT_SOUND_SETTINGS)
  })

  it('keeps saved choices and clamps the volume', () => {
    expect(parseSoundSettings(JSON.stringify({ sound: false, volume: 0.3, vibrate: false })))
      .toEqual({ sound: false, volume: 0.3, vibrate: false })
    expect(parseSoundSettings(JSON.stringify({ volume: 4 })).volume).toBe(1)
    expect(parseSoundSettings(JSON.stringify({ volume: -1 })).volume).toBe(0)
  })

  it('ignores fields of the wrong type', () => {
    expect(parseSoundSettings(JSON.stringify({ sound: 'yes', volume: 'loud' })))
      .toEqual(DEFAULT_SOUND_SETTINGS)
  })
})
