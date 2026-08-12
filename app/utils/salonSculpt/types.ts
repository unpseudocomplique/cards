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

export type FacialHair = 'none' | 'short_beard' | 'full_beard' | 'handlebar'

export type GlassesStyle = 'none' | 'oval' | 'round'

export type BowTieStyle = 'none' | 'black' | 'white' | 'burgundy' | 'gold_ornate'

export type PinStyle = 'none' | 'sphere' | 'compass' | 'eye' | 'filigree'

export type EarringStyle = 'none' | 'stud' | 'hoop'

export type HairOrnament = 'none' | 'laurel'

export type CollarStyle = 'shirt' | 'wing' | 'blouse' | 'vneck'

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
  build: 'masculine' | 'feminine' | 'androgynous'
  eyeColor: string
  lipColor: string
  browColor: string
  facialHair: FacialHair
  glasses: GlassesStyle
  bowTie: BowTieStyle
  scarf: boolean
  earrings: EarringStyle
  hairOrnament: HairOrnament
  pinStyle: PinStyle
  collar: CollarStyle
  /** Skull width vs height (1 = average). */
  faceWidth: number
  jawWidth: number
  noseScale: number
  eyeScale: number
  /** 0 young, 1 elder — drives crease / silver mix. */
  age: number
}

export type SalonModelOptions = {
  shadows?: boolean
}
