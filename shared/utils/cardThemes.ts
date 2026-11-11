/**
 * Deck colour themes.
 *
 * One theme drives everything that makes a deck look like a single object:
 * - the AI prompts (scene, character and card back share the same palette),
 * - the rendered chrome (paper, outer contour, scene frame, index ink),
 * - the card back border.
 *
 * Every card of a deck — figures, numerals, trumps and the back — uses the
 * same theme, so frames and colours never drift from one card to another.
 */

export const cardThemeIds = ['royal', 'nuit', 'foret', 'atelier', 'riviera'] as const

export type CardThemeId = typeof cardThemeIds[number]

export type CardTheme = {
  id: CardThemeId
  label: string
  description: string
  /** Hex colours used by the renderer. */
  colors: {
    /** Card stock (margins, index corners). */
    paper: string
    /** Outer contour + scene frame. Identical on faces and back. */
    frame: string
    /** Hairline inside the scene frame. */
    hairline: string
    /** Ink for hearts / diamonds indices. */
    redInk: string
    /** Ink for clubs / spades / trumps indices. */
    darkInk: string
  }
  /** English palette description injected into every prompt of the deck. */
  palette: string
  /** Accent wording for warm suits (hearts, diamonds). */
  warmAccent: string
  /** Accent wording for dark suits (clubs, spades). */
  coolAccent: string
  /** Lighting shared by scene and character so both layers match. */
  lighting: string
}

export const cardThemes: Record<CardThemeId, CardTheme> = {
  royal: {
    id: 'royal',
    label: 'Royal ivoire',
    description: 'Ivoire, bordeaux et bleu nuit, touches de laiton.',
    colors: {
      paper: '#f8f3e8',
      frame: '#22304f',
      hairline: '#b89a5e',
      redInk: '#a3232d',
      darkInk: '#1a1d26'
    },
    palette: 'a restrained royal palette of ivory, deep burgundy, midnight blue and muted brass',
    warmAccent: 'deep burgundy and crimson',
    coolAccent: 'midnight blue and charcoal',
    lighting: 'soft warm key light from the upper left, gentle shadows'
  },
  nuit: {
    id: 'nuit',
    label: 'Nuit étoilée',
    description: 'Bleu nuit, ardoise et argent, lumière de lune.',
    colors: {
      paper: '#f1f3f7',
      frame: '#1b2540',
      hairline: '#8d99b3',
      redInk: '#b02e3b',
      darkInk: '#141a2b'
    },
    palette: 'a nocturnal palette of midnight blue, slate, silver grey and pale moonlight, with restrained crimson accents',
    warmAccent: 'muted crimson and rose',
    coolAccent: 'midnight blue and silver grey',
    lighting: 'cool moonlit key light from the upper left, soft blue shadows'
  },
  foret: {
    id: 'foret',
    label: 'Forêt ancienne',
    description: 'Vert profond, mousse, cuivre et parchemin.',
    colors: {
      paper: '#f4f0e2',
      frame: '#26392d',
      hairline: '#a8784a',
      redInk: '#a53a2c',
      darkInk: '#1c261f'
    },
    palette: 'an old-forest palette of deep green, moss, warm copper and parchment, with brick-red accents',
    warmAccent: 'brick red and warm copper',
    coolAccent: 'deep forest green and dark moss',
    lighting: 'dappled warm light from the upper left, soft green-tinted shadows'
  },
  atelier: {
    id: 'atelier',
    label: 'Atelier sépia',
    description: 'Sépia, terre de Sienne, ocre et papier crème.',
    colors: {
      paper: '#f6eddc',
      frame: '#4a3427',
      hairline: '#b48a5a',
      redInk: '#9c3a25',
      darkInk: '#2a2019'
    },
    palette: 'a vintage atelier palette of warm sepia, burnt sienna, ochre and cream paper, like an engraved and hand-coloured print',
    warmAccent: 'burnt sienna and rust red',
    coolAccent: 'umber brown and aged ink black',
    lighting: 'warm candle-like light from the upper left, soft brown shadows'
  },
  riviera: {
    id: 'riviera',
    label: 'Riviera solaire',
    description: 'Azur, sarcelle, terracotta et sable doré.',
    colors: {
      paper: '#fbf6ec',
      frame: '#1d4c68',
      hairline: '#d39b45',
      redInk: '#c13f2e',
      darkInk: '#152c3a'
    },
    palette: 'a sunlit Mediterranean palette of azure, teal, terracotta and warm sand',
    warmAccent: 'terracotta and coral red',
    coolAccent: 'deep teal and navy',
    lighting: 'bright warm daylight from the upper left, soft clear shadows'
  }
}

export const defaultCardThemeId: CardThemeId = 'royal'

export function isCardThemeId(value: unknown): value is CardThemeId {
  return typeof value === 'string' && (cardThemeIds as readonly string[]).includes(value)
}

export function getCardTheme(id?: string | null): CardTheme {
  return isCardThemeId(id) ? cardThemes[id] : cardThemes[defaultCardThemeId]
}

export const cardThemeOptions = cardThemeIds.map(id => cardThemes[id])
