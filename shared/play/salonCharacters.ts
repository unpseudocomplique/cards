/** Base salon cast — Gemini full-body refs + img2threejs seated factories. */
export type SalonAccessory = 'pin' | 'glasses' | 'scarf' | 'bow' | 'none'

const FULL_BODY_FRAME = [
  'Full-body 3D character reference for image-to-3D reconstruction.',
  'The ENTIRE figure is visible from the crown of the hair to the soles of the shoes: head, torso, both arms, both hands, both legs, both shoes. No cropping, no close-up bust.',
  'The person is seated in a carved wooden salon armchair, three-quarter view facing the camera, knees and feet clearly visible, hands resting on the thighs.',
  'Luxury French tarot salon, warm candlelight, painterly illustration with readable volumes and a sharp silhouette.',
  'Simple dark burgundy studio background, no ornate picture frame, no text, no watermark.',
  'Vertical composition.'
].join(' ')

export type SalonCharacter = {
  id: string
  name: string
  /** French short bio for UI / future profiles */
  blurb: string
  accent: string
  accessory: SalonAccessory
  /** Seed for procedural suit/skin/hair palette fallback */
  seed: number
  /** Identity clause fed into the Gemini full-body prompt */
  identity: string
  /** Gemini full-body seated prompt (head-to-toe, no text) */
  portraitPrompt: string
  /** Public path once generated */
  portraitPath: string
}

function fullBodyPrompt(identity: string) {
  return `${identity} ${FULL_BODY_FRAME}`
}

export const SALON_CHARACTERS: SalonCharacter[] = [
  {
    id: 'aurelien',
    name: 'Aurélien',
    blurb: 'Banquier mondain, joue la garde sans un sourire.',
    accent: '#d4a84b',
    accessory: 'glasses',
    seed: 0,
    identity: 'A refined French man in his 40s, warm olive skin, short salt-and-pepper hair, thin gold oval glasses, salt-and-pepper beard, black tuxedo, ivory shirt, black bow tie.',
    portraitPrompt: fullBodyPrompt('A refined French man in his 40s, warm olive skin, short salt-and-pepper hair, thin gold oval glasses, salt-and-pepper beard, black tuxedo, ivory shirt, black bow tie.'),
    portraitPath: '/salon-cast/aurelien.png',
  },
  {
    id: 'camille',
    name: 'Camille',
    blurb: 'Critique d’art, lit les atouts comme des tableaux.',
    accent: '#e0c06a',
    accessory: 'scarf',
    seed: 2,
    identity: 'An elegant French woman in her 30s, light skin, dark wavy hair in an updo with face-framing curls, black velvet jacket, gold silk scarf, gold hoop earrings.',
    portraitPrompt: fullBodyPrompt('An elegant French woman in her 30s, light skin, dark wavy hair in an updo with face-framing curls, black velvet jacket, gold silk scarf, gold hoop earrings.'),
    portraitPath: '/salon-cast/camille.png',
  },
  {
    id: 'hassan',
    name: 'Hassan',
    blurb: 'Collectionneur discret, jamais pressé.',
    accent: '#c9a227',
    accessory: 'pin',
    seed: 1,
    identity: 'A distinguished Middle Eastern man in his 50s, deep brown skin, short cropped hair, trimmed salt-and-pepper beard, black patterned dinner jacket, white shirt, black bow tie, gold compass-rose lapel pin with a red gem.',
    portraitPrompt: fullBodyPrompt('A distinguished Middle Eastern man in his 50s, deep brown skin, short cropped hair, trimmed salt-and-pepper beard, black patterned dinner jacket, white shirt, black bow tie, gold compass-rose lapel pin with a red gem.'),
    portraitPath: '/salon-cast/hassan.png',
  },
  {
    id: 'ines',
    name: 'Inès',
    blurb: 'Violiniste, rythme ses plis comme une partition.',
    accent: '#d4a84b',
    accessory: 'bow',
    seed: 4,
    identity: 'A young Mediterranean woman, olive skin, jet-black chin-length bob, black tuxedo shirt, large ornate gold metallic bow tie, sharp cheekbones.',
    portraitPrompt: fullBodyPrompt('A young Mediterranean woman, olive skin, jet-black chin-length bob, black tuxedo shirt, large ornate gold metallic bow tie, sharp cheekbones.'),
    portraitPath: '/salon-cast/ines.png',
  },
  {
    id: 'julien',
    name: 'Julien',
    blurb: 'Ancien croupier, compte les points trop vite.',
    accent: '#b08d3e',
    accessory: 'pin',
    seed: 3,
    identity: 'A charismatic French man in his 30s, fair skin, chestnut hair slicked back, prominent handlebar mustache, charcoal three-piece suit, white shirt, dark necktie, gold eye-of-providence lapel pin.',
    portraitPrompt: fullBodyPrompt('A charismatic French man in his 30s, fair skin, chestnut hair slicked back, prominent handlebar mustache, charcoal three-piece suit, white shirt, dark necktie, gold eye-of-providence lapel pin.'),
    portraitPath: '/salon-cast/julien.png',
  },
  {
    id: 'lea',
    name: 'Léa',
    blurb: 'Architecte, construit ses défenses carte par carte.',
    accent: '#e8c070',
    accessory: 'glasses',
    seed: 6,
    identity: 'A stylish Black French woman in her 30s, deep brown skin, short natural curls with a gold laurel hair clip, round gold glasses, black blazer, cream silk blouse, gold hoop earrings.',
    portraitPrompt: fullBodyPrompt('A stylish Black French woman in her 30s, deep brown skin, short natural curls with a gold laurel hair clip, round gold glasses, black blazer, cream silk blouse, gold hoop earrings.'),
    portraitPath: '/salon-cast/lea.png',
  },
  {
    id: 'marco',
    name: 'Marco',
    blurb: 'Importateur de vins, parle peu, surenchérit fort.',
    accent: '#c4a35a',
    accessory: 'bow',
    seed: 5,
    identity: 'An Italian man in his 45s, tanned skin, thick dark wavy hair, salt-and-pepper beard, black tuxedo, white shirt, burgundy bow tie, warm smile.',
    portraitPrompt: fullBodyPrompt('An Italian man in his 45s, tanned skin, thick dark wavy hair, salt-and-pepper beard, black tuxedo, white shirt, burgundy bow tie, warm smile.'),
    portraitPath: '/salon-cast/marco.png',
  },
  {
    id: 'nadege',
    name: 'Nadège',
    blurb: 'Professeure de lettres, adore l’Excuse.',
    accent: '#d0b060',
    accessory: 'scarf',
    seed: 7,
    identity: 'A graceful older French woman, warm brown skin, silver wavy hair in a low bun, black evening dress, gold-embroidered shawl, gold stud earrings and a small gold necklace.',
    portraitPrompt: fullBodyPrompt('A graceful older French woman, warm brown skin, silver wavy hair in a low bun, black evening dress, gold-embroidered shawl, gold stud earrings and a small gold necklace.'),
    portraitPath: '/salon-cast/nadege.png',
  },
  {
    id: 'olivier',
    name: 'Olivier',
    blurb: 'Notaire à la retraite, jamais de prise.',
    accent: '#b8974a',
    accessory: 'glasses',
    seed: 0,
    identity: 'An older French gentleman in his 70s, pale skin, short white hair swept back, round gold glasses, classic black tuxedo, ivory wing collar, white bow tie.',
    portraitPrompt: fullBodyPrompt('An older French gentleman in his 70s, pale skin, short white hair swept back, round gold glasses, classic black tuxedo, ivory wing collar, white bow tie.'),
    portraitPath: '/salon-cast/olivier.png',
  },
  {
    id: 'sofia',
    name: 'Sofia',
    blurb: 'Galériste, mise sur le style autant que les points.',
    accent: '#e0c06a',
    accessory: 'pin',
    seed: 2,
    identity: 'A glamorous South American woman in her 30s, golden-brown skin, long dark wavy hair over one shoulder, black satin jacket, gold filigree brooch, gold stud earrings.',
    portraitPrompt: fullBodyPrompt('A glamorous South American woman in her 30s, golden-brown skin, long dark wavy hair over one shoulder, black satin jacket, gold filigree brooch, gold stud earrings.'),
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
