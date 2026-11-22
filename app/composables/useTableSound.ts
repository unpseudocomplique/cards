import { playRecipe, TABLE_VIBRATIONS } from '~/utils/tableSounds'
import type { TableSound, TableVibration } from '~/utils/tableSounds'

const STORAGE_KEY = 'cards:play-sound'

export type TableSoundSettings = {
  /** Table sounds on or off. */
  sound: boolean
  /** Master volume, 0 to 1. */
  volume: number
  /** Vibrations on phones that support them. */
  vibrate: boolean
}

export const DEFAULT_SOUND_SETTINGS: TableSoundSettings = { sound: true, volume: 0.7, vibrate: true }

export function parseSoundSettings(raw: string | null): TableSoundSettings {
  if (!raw) {
    return { ...DEFAULT_SOUND_SETTINGS }
  }
  try {
    const value = JSON.parse(raw) as Partial<TableSoundSettings>
    const volume = typeof value.volume === 'number' && Number.isFinite(value.volume)
      ? Math.min(1, Math.max(0, value.volume))
      : DEFAULT_SOUND_SETTINGS.volume
    return {
      sound: typeof value.sound === 'boolean' ? value.sound : DEFAULT_SOUND_SETTINGS.sound,
      volume,
      vibrate: typeof value.vibrate === 'boolean' ? value.vibrate : DEFAULT_SOUND_SETTINGS.vibrate
    }
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS }
  }
}

/* One audio context for the whole app, created at the first touch (browsers require it). */
let audio: { ctx: AudioContext, master: GainNode } | null = null

function ensureAudio(): typeof audio {
  if (audio || !import.meta.client) {
    return audio
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) {
    return null
  }
  try {
    // iPhone: mix with the music already playing and respect the silent switch.
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession
    if (session) {
      session.type = 'ambient'
    }
  } catch {
    // Older Safari.
  }
  const ctx = new Ctor()
  const master = ctx.createGain()
  const compressor = ctx.createDynamicsCompressor()
  master.connect(compressor).connect(ctx.destination)
  audio = { ctx, master }
  return audio
}

/** Perceived loudness grows faster at the low end of the slider. */
function gainFor(volume: number) {
  return volume * volume
}

/**
 * Sounds and vibrations of the play table, set in the table settings and kept
 * on each device.
 */
export function useTableSound() {
  const settings = useState<TableSoundSettings>('play-sound', () => ({ ...DEFAULT_SOUND_SETTINGS }))
  const loaded = useState('play-sound-loaded', () => false)
  const canVibrate = useState('play-sound-can-vibrate', () => false)

  if (import.meta.client && !loaded.value) {
    loaded.value = true
    canVibrate.value = typeof navigator.vibrate === 'function'
    try {
      settings.value = parseSoundSettings(window.localStorage.getItem(STORAGE_KEY))
    } catch {
      // Private mode or blocked storage: keep the defaults.
    }
  }

  function update(patch: Partial<TableSoundSettings>) {
    settings.value = parseSoundSettings(JSON.stringify({ ...settings.value, ...patch }))
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    } catch {
      // Not saved; still applied for this visit.
    }
  }

  function play(sound: TableSound, delay = 0) {
    if (!import.meta.client || !settings.value.sound || settings.value.volume <= 0) {
      return
    }
    const engine = ensureAudio()
    if (!engine || engine.ctx.state === 'closed') {
      return
    }
    if (engine.ctx.state === 'suspended') {
      // Not unlocked yet (no touch so far) or the tab was in the background.
      // Skip this one rather than let queued sounds burst out together later.
      void engine.ctx.resume().catch(() => {})
      return
    }
    engine.master.gain.value = gainFor(settings.value.volume)
    try {
      playRecipe(engine.ctx, engine.master, sound, delay)
    } catch {
      // A sound never breaks the game.
    }
  }

  function vibrate(kind: TableVibration) {
    if (!import.meta.client || !settings.value.vibrate || !canVibrate.value) {
      return
    }
    try {
      navigator.vibrate([...TABLE_VIBRATIONS[kind]])
    } catch {
      // Blocked until the first touch.
    }
  }

  /** Browsers start audio only after a touch: unlock it at the first one. */
  function install() {
    if (!import.meta.client) {
      return
    }
    const unlock = () => {
      const engine = ensureAudio()
      if (engine?.ctx.state === 'suspended') {
        void engine.ctx.resume().catch(() => {})
      }
    }
    const options = { capture: true, passive: true } as const
    onMounted(() => {
      window.addEventListener('pointerdown', unlock, options)
      window.addEventListener('keydown', unlock, options)
    })
    onBeforeUnmount(() => {
      window.removeEventListener('pointerdown', unlock, options)
      window.removeEventListener('keydown', unlock, options)
    })
  }

  return { settings, canVibrate, update, play, vibrate, install }
}
