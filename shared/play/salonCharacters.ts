/** Base salon cast — AI portraits + img2threejs seated factories. */
export type SalonAccessory = 'pin' | 'glasses' | 'scarf' | 'bow' | 'none'

export type SalonCharacter = {
  id: string
  name: string
  /** French short bio for UI / future profiles */
  blurb: string
  accent: string
  accessory: SalonAccessory
  /** Seed for procedural suit/skin/hair palette fallback */
  seed: number
  /** Gemini portrait prompt (bust, salon evening wear, no text) */
  portraitPrompt: string
  /** Public path once generated */
  portraitPath: string
}

export const SALON_CHARACTERS: SalonCharacter[] = [
  {
    id: 'aurelien',
    name: 'Aurélien',
    blurb: 'Banquier mondain, joue la garde sans un sourire.',
    accent: '#d4a84b',
    accessory: 'glasses',
    seed: 0,
    portraitPrompt: 'Portrait bust of a refined French man in his 40s for a luxury tarot salon game, warm olive skin, short salt-and-pepper hair, thin gold glasses, black tuxedo and ivory shirt, soft candlelight, painterly illustration, three-quarter view facing camera, no text, no watermark, dark burgundy background',
    portraitPath: '/salon-cast/aurelien.png',
  },
  {
    id: 'camille',
    name: 'Camille',
    blurb: 'Critique d’art, lit les atouts comme des tableaux.',
    accent: '#e0c06a',
    accessory: 'scarf',
    seed: 2,
    portraitPrompt: 'Portrait bust of an elegant French woman in her 30s for a luxury card salon, light skin, dark wavy hair pinned up, black velvet jacket, gold silk scarf, subtle makeup, soft chandelier light, painterly illustration, three-quarter view facing camera, no text, no watermark, deep crimson background',
    portraitPath: '/salon-cast/camille.png',
  },
  {
    id: 'hassan',
    name: 'Hassan',
    blurb: 'Collectionneur discret, jamais pressé.',
    accent: '#c9a227',
    accessory: 'pin',
    seed: 1,
    portraitPrompt: 'Portrait bust of a distinguished Middle Eastern man in his 50s for a luxury tarot salon, deep brown skin, trimmed beard, black dinner jacket, gold lapel pin, calm confident expression, soft warm lighting, painterly illustration, three-quarter view facing camera, no text, no watermark, dark wood panel background',
    portraitPath: '/salon-cast/hassan.png',
  },
  {
    id: 'ines',
    name: 'Inès',
    blurb: 'Violiniste, rythme ses plis comme une partition.',
    accent: '#d4a84b',
    accessory: 'bow',
    seed: 4,
    portraitPrompt: 'Portrait bust of a young Mediterranean woman for a luxury card salon, olive skin, black bob haircut, black tuxedo shirt with gold bow tie, sharp cheekbones, soft candlelight, painterly illustration, three-quarter view facing camera, no text, no watermark, burgundy velvet background',
    portraitPath: '/salon-cast/ines.png',
  },
  {
    id: 'julien',
    name: 'Julien',
    blurb: 'Ancien croupier, compte les points trop vite.',
    accent: '#b08d3e',
    accessory: 'pin',
    seed: 3,
    portraitPrompt: 'Portrait bust of a charismatic French man in his 30s for a luxury tarot salon, fair skin, chestnut hair slicked back, black suit, white shirt, gold pin, slight smirk, warm dramatic lighting, painterly illustration, three-quarter view facing camera, no text, no watermark, dark salon background',
    portraitPath: '/salon-cast/julien.png',
  },
  {
    id: 'lea',
    name: 'Léa',
    blurb: 'Architecte, construit ses défenses carte par carte.',
    accent: '#e8c070',
    accessory: 'glasses',
    seed: 6,
    portraitPrompt: 'Portrait bust of a stylish Black French woman in her 30s for a luxury card salon, deep brown skin, short natural hair with gold clip, black blazer, cream blouse, thin gold glasses, poised expression, soft chandelier glow, painterly illustration, three-quarter view facing camera, no text, no watermark, dark crimson background',
    portraitPath: '/salon-cast/lea.png',
  },
  {
    id: 'marco',
    name: 'Marco',
    blurb: 'Importateur de vins, parle peu, surenchérit fort.',
    accent: '#c4a35a',
    accessory: 'bow',
    seed: 5,
    portraitPrompt: 'Portrait bust of an Italian man in his 45s for a luxury tarot salon, tanned skin, thick dark hair, black tuxedo, burgundy bow tie, warm smile lines, candlelit ambience, painterly illustration, three-quarter view facing camera, no text, no watermark, wood and velvet background',
    portraitPath: '/salon-cast/marco.png',
  },
  {
    id: 'nadege',
    name: 'Nadège',
    blurb: 'Professeure de lettres, adore l’Excuse.',
    accent: '#d0b060',
    accessory: 'scarf',
    seed: 7,
    portraitPrompt: 'Portrait bust of a graceful older French woman for a luxury card salon, warm brown skin, silver-streaked hair in a bun, black evening dress with gold scarf, kind intelligent eyes, soft warm light, painterly illustration, three-quarter view facing camera, no text, no watermark, deep burgundy background',
    portraitPath: '/salon-cast/nadege.png',
  },
  {
    id: 'olivier',
    name: 'Olivier',
    blurb: 'Notaire à la retraite, jamais de prise.',
    accent: '#b8974a',
    accessory: 'glasses',
    seed: 0,
    portraitPrompt: 'Portrait bust of an older French gentleman for a luxury tarot salon, pale skin, white hair, round gold glasses, classic black tuxedo, ivory bow tie, serene expression, soft candlelight, painterly illustration, three-quarter view facing camera, no text, no watermark, dark wood background',
    portraitPath: '/salon-cast/olivier.png',
  },
  {
    id: 'sofia',
    name: 'Sofia',
    blurb: 'Galériste, mise sur le style autant que les points.',
    accent: '#e0c06a',
    accessory: 'pin',
    seed: 2,
    portraitPrompt: 'Portrait bust of a glamorous South American woman in her 30s for a luxury card salon, golden-brown skin, long dark hair with waves, black satin jacket, gold jewelry pin, confident gaze, dramatic warm lighting, painterly illustration, three-quarter view facing camera, no text, no watermark, crimson velvet background',
    portraitPath: '/salon-cast/sofia.png',
  },
]

export function salonCharacterById(id: string): SalonCharacter | undefined {
  return SALON_CHARACTERS.find(c => c.id === id)
}

/** Stable cast pick for a table seat (bots / placeholders). */
export function salonCharacterForSeat(seat: number, salt = 0): SalonCharacter {
  const index = Math.abs(seat * 3 + salt) % SALON_CHARACTERS.length
  return SALON_CHARACTERS[index]!
}
