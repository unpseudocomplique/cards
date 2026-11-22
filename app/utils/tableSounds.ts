/**
 * Table sounds, synthesised on the fly with the Web Audio API: no audio file
 * to download or license, every sound is original. Each recipe draws into
 * `out` (the master volume) starting at `at` (AudioContext time, seconds).
 */

export type TableSound
  = | 'card'
    | 'gather'
    | 'turn'
    | 'dealWin'
    | 'dealLose'
    | 'matchWin'
    | 'emote'
    | 'cut'
    | 'deal'
    | 'bid'
    | 'bout'
    | 'chien'
    | 'preview'

type Recipe = (ctx: AudioContext, out: AudioNode, at: number) => void

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

/** One second of white noise, shared by the paper-like sounds. */
function noise(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseCache.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    noiseCache.set(ctx, buffer)
  }
  return buffer
}

function jitter(amount: number) {
  return 1 + (Math.random() * 2 - 1) * amount
}

/** Short filtered noise: a card brushing or slapping the felt. */
function paper(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  { freq, q = 0.9, gain, attack = 0.002, decay, sweepTo }: { freq: number, q?: number, gain: number, attack?: number, decay: number, sweepTo?: number }
) {
  const source = ctx.createBufferSource()
  source.buffer = noise(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = q
  filter.frequency.setValueAtTime(freq, at)
  if (sweepTo) {
    filter.frequency.exponentialRampToValueAtTime(sweepTo, at + attack + decay)
  }
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(gain, at + attack)
  env.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
  source.connect(filter).connect(env).connect(out)
  source.start(at, Math.random() * 0.5)
  source.stop(at + attack + decay + 0.02)
}

/** A sine (or other) tone with a soft attack and an exponential tail. */
function tone(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  { freq, gain, decay, attack = 0.006, type = 'sine', glideTo }: { freq: number, gain: number, decay: number, attack?: number, type?: OscillatorType, glideTo?: number }
) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  if (glideTo) {
    osc.frequency.exponentialRampToValueAtTime(glideTo, at + attack + decay * 0.6)
  }
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(gain, at + attack)
  env.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
  osc.connect(env).connect(out)
  osc.start(at)
  osc.stop(at + attack + decay + 0.02)
}

/** Wooden mallet note (marimba-like): fundamental plus a quick bright partial. */
function mallet(ctx: AudioContext, out: AudioNode, at: number, freq: number, gain: number, decay = 0.5) {
  tone(ctx, out, at, { freq, gain, decay, attack: 0.004 })
  tone(ctx, out, at, { freq: freq * 4, gain: gain * 0.18, decay: decay * 0.18, attack: 0.002 })
  tone(ctx, out, at, { freq: freq * 2, gain: gain * 0.25, decay: decay * 0.4, attack: 0.003, type: 'triangle' })
}

/** Small bell: inharmonic partials that ring for a while. */
function bell(ctx: AudioContext, out: AudioNode, at: number, freq: number, gain: number, decay = 1.2) {
  const partials: Array<[number, number, number]> = [[1, 1, 1], [2.76, 0.35, 0.55], [5.4, 0.16, 0.3], [8.93, 0.07, 0.18]]
  for (const [ratio, level, length] of partials) {
    tone(ctx, out, at, { freq: freq * ratio, gain: gain * level, decay: decay * length, attack: 0.003 })
  }
}

const NOTE = {
  C4: 261.63, E4: 329.63, G4: 392, A4: 440, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5
}

const RECIPES: Record<TableSound, Recipe> = {
  /** A card laid on the felt: soft slap plus a muffled thump. */
  card(ctx, out, at) {
    paper(ctx, out, at, { freq: 2200 * jitter(0.15), q: 0.7, gain: 0.55, decay: 0.07 })
    paper(ctx, out, at + 0.004, { freq: 600 * jitter(0.1), q: 1.2, gain: 0.35, decay: 0.05 })
    tone(ctx, out, at, { freq: 150 * jitter(0.08), glideTo: 70, gain: 0.35, decay: 0.07, attack: 0.002 })
  },
  /** The trick swept to its winner: a swish, then the cards squaring up. */
  gather(ctx, out, at) {
    paper(ctx, out, at, { freq: 700, sweepTo: 2600, q: 0.8, gain: 0.32, attack: 0.09, decay: 0.24 })
    paper(ctx, out, at + 0.26, { freq: 1700, q: 1, gain: 0.25, decay: 0.04 })
    paper(ctx, out, at + 0.31, { freq: 1500, q: 1, gain: 0.2, decay: 0.04 })
  },
  /** Your turn: two soft mallet notes going up. */
  turn(ctx, out, at) {
    mallet(ctx, out, at, NOTE.E5, 0.28, 0.45)
    mallet(ctx, out, at + 0.12, NOTE.A5, 0.3, 0.7)
  },
  /** Deal won: a bright rising arpeggio. */
  dealWin(ctx, out, at) {
    const notes = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6]
    notes.forEach((freq, i) => mallet(ctx, out, at + i * 0.1, freq, 0.26, i === notes.length - 1 ? 1.1 : 0.4))
    bell(ctx, out, at + 0.3, NOTE.E6, 0.06, 1.2)
  },
  /** Deal lost: three notes stepping down, quieter. */
  dealLose(ctx, out, at) {
    const notes = [NOTE.G4, NOTE.E4, NOTE.C4]
    notes.forEach((freq, i) => mallet(ctx, out, at + i * 0.16, freq, 0.22, i === notes.length - 1 ? 0.9 : 0.35))
  },
  /** Match won: a longer fanfare of mallets and bells. */
  matchWin(ctx, out, at) {
    const notes = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.G5, NOTE.C6]
    const steps = [0, 0.1, 0.2, 0.36, 0.46, 0.6]
    notes.forEach((freq, i) => mallet(ctx, out, at + steps[i]!, freq, 0.26, i === notes.length - 1 ? 1.4 : 0.35))
    bell(ctx, out, at + 0.6, NOTE.C6, 0.12, 1.6)
    bell(ctx, out, at + 0.64, NOTE.E6, 0.06, 1.4)
  },
  /** A reaction: a little bubble pop. */
  emote(ctx, out, at) {
    tone(ctx, out, at, { freq: 380, glideTo: 950, gain: 0.22, decay: 0.09, attack: 0.004 })
    tone(ctx, out, at + 0.07, { freq: 1200, gain: 0.05, decay: 0.05, attack: 0.002 })
  },
  /** The cut: the packet lifted then dropped under the rest. */
  cut(ctx, out, at) {
    for (let i = 0; i < 9; i++) {
      paper(ctx, out, at + i * 0.028 * jitter(0.25), { freq: 3000 * jitter(0.2), q: 1.4, gain: 0.12, decay: 0.018 })
    }
    paper(ctx, out, at + 0.32, { freq: 1100, q: 0.8, gain: 0.4, decay: 0.08 })
    tone(ctx, out, at + 0.32, { freq: 120, glideTo: 60, gain: 0.3, decay: 0.08, attack: 0.002 })
  },
  /** The deal: cards sliding out one after the other. */
  deal(ctx, out, at) {
    for (let i = 0; i < 8; i++) {
      paper(ctx, out, at + i * 0.085 * jitter(0.1), { freq: 1600 * jitter(0.15), sweepTo: 3200, q: 0.9, gain: 0.16, attack: 0.012, decay: 0.05 })
    }
  },
  /** A bid spoken: a wooden knock on the table. */
  bid(ctx, out, at) {
    tone(ctx, out, at, { freq: 210 * jitter(0.05), glideTo: 160, gain: 0.4, decay: 0.09, attack: 0.002 })
    paper(ctx, out, at, { freq: 900, q: 2, gain: 0.18, decay: 0.03 })
  },
  /** A bout on the table: a short brass shimmer. */
  bout(ctx, out, at) {
    bell(ctx, out, at, NOTE.A5, 0.1, 1.3)
    bell(ctx, out, at + 0.08, NOTE.E6, 0.06, 1.1)
  },
  /** The dog turned face up: cards fanned out. */
  chien(ctx, out, at) {
    for (let i = 0; i < 4; i++) {
      paper(ctx, out, at + i * 0.07, { freq: 1300 + i * 300, sweepTo: 2800, q: 0.9, gain: 0.18, attack: 0.015, decay: 0.07 })
    }
  },
  /** Volume preview in the settings. */
  preview(ctx, out, at) {
    RECIPES.card(ctx, out, at)
    mallet(ctx, out, at + 0.12, NOTE.A5, 0.22, 0.5)
  }
}

export function playRecipe(ctx: AudioContext, out: AudioNode, sound: TableSound, delay = 0) {
  RECIPES[sound](ctx, out, ctx.currentTime + 0.01 + Math.max(0, delay))
}

/** Vibration patterns (ms), for phones that support it (not iPhone). */
export const TABLE_VIBRATIONS = {
  turn: [18, 70, 18],
  trickWon: [12],
  dealWin: [25, 50, 25, 50, 60],
  dealLose: [90],
  cut: [10],
  emote: [8]
} as const satisfies Record<string, readonly number[]>

export type TableVibration = keyof typeof TABLE_VIBRATIONS
