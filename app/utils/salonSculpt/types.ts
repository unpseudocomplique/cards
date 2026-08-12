import type { SalonAccessory } from '~~/shared/play/salonCharacters'

/** Per-cast sculpt parameters (img2threejs character track). */
export type HairStyle =
  | 'short_slick'
  | 'salt_pepper'
  | 'updo'
  | 'bob'
  | 'natural_short'
  | 'thick_dark'
  | 'bun_silver'
  | 'white_short'
  | 'long_waves'
  | 'cropped_beard'

export type OutfitStyle = 'tuxedo' | 'velvet_jacket' | 'evening_dress' | 'dinner_jacket'

export type SalonSculptSpec = {
  id: string
  displayName: string
  portraitUrl: string
  accent: string
  accessory: SalonAccessory
  /** Head-units relative body (≈7.5 HU seated compression). */
  headScale: number
  shoulderWidth: number
  torsoDepth: number
  hipWidth: number
  skin: string
  hair: string
  suit: string
  shirt: string
  shoe: string
  hairStyle: HairStyle
  outfit: OutfitStyle
  /** Soft gender/build cue for hip/shoulder bias */
  build: 'masculine' | 'feminine' | 'androgynous'
  hasBeard?: boolean
  /** Face crop in portrait UV space (skip ornate frames). */
  faceCrop: { sx: number, sy: number, sw: number, sh: number }
}

export type SalonModelOptions = {
  shadows?: boolean
}
