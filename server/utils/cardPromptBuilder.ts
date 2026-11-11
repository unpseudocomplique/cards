import type { DeckStyleSettings } from '~~/server/database/schema'
import type { CardPromptRole, CardPromptSuit } from '~~/shared/utils/cardPromptPresets'
import { cardPromptRoleValues, cardPromptSuitValues, mergeRolePrompts, mergeSuitPrompts } from '~~/shared/utils/cardPromptPresets'
import { getCardTheme } from '~~/shared/utils/cardThemes'
import { getTarotArcana, getTarotArcanaPromptHint } from '~~/shared/utils/tarotArcana'

type PromptCard = {
  label: string
  promptHint: string
  rank?: string
  role?: string
  shortLabel?: string
  suit?: string
}

function isPromptRole(role?: string): role is CardPromptRole {
  return cardPromptRoleValues.includes(role as CardPromptRole)
}

function isPromptSuit(suit?: string): suit is CardPromptSuit {
  return cardPromptSuitValues.includes(suit as CardPromptSuit)
}

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function buildStructuredPrompt(options: {
  subject: string
  context: Array<string | null | undefined>
  style: Array<string | null | undefined>
  constraints?: Array<string | null | undefined>
}) {
  return joinParts([
    options.subject,
    joinParts(options.context),
    `Style: ${joinParts(options.style)}.`,
    options.constraints?.length ? joinParts(options.constraints) : null
  ])
}

function getRoleContext(card: PromptCard, settings: DeckStyleSettings) {
  const role = isPromptRole(card.role) ? card.role : null

  if (!role) {
    return null
  }

  return mergeRolePrompts(settings.rolePrompts)[role]
}

function getSuitContext(card: PromptCard, settings: DeckStyleSettings) {
  const suit = isPromptSuit(card.suit) ? card.suit : null

  if (!suit) {
    return null
  }

  return mergeSuitPrompts(settings.suitPrompts)[suit]
}

/** Suit accent expressed inside the deck palette (never a colour of its own). */
function getSuitAccent(card: PromptCard, settings: DeckStyleSettings) {
  const theme = getCardTheme(settings.colorTheme)

  if (card.suit === 'hearts' || card.suit === 'diamonds') {
    return `Suit accent: ${theme.warmAccent}, used sparingly within the deck palette.`
  }

  if (card.suit === 'clubs' || card.suit === 'spades') {
    return `Suit accent: ${theme.coolAccent}, used sparingly within the deck palette.`
  }

  return null
}

/**
 * Art direction shared by every image of the deck (scene, character, back).
 * Same palette + same light on each layer is what makes the deck read as one set.
 */
function getDeckArtDirection(settings: DeckStyleSettings) {
  const theme = getCardTheme(settings.colorTheme)

  return [
    `Deck colour theme: ${theme.palette}. Stay strictly inside this palette, no off-palette saturated colours.`,
    `Lighting: ${theme.lighting}.`
  ]
}

/** Always resolve Marseille arcana meaning from role/rank, even for older decks. */
function getArcanaContext(card: PromptCard) {
  const arcana = getTarotArcana(card.role, card.rank)

  if (!arcana) {
    return card.promptHint || null
  }

  const fromCatalog = getTarotArcanaPromptHint(arcana)

  // Prefer live arcana text; keep a custom promptHint only if it adds something else.
  if (card.promptHint && card.promptHint !== fromCatalog && !card.promptHint.includes(arcana.name)) {
    return joinParts([fromCatalog, card.promptHint])
  }

  return fromCatalog
}

function getCardDisplayName(card: PromptCard) {
  const arcana = getTarotArcana(card.role, card.rank)

  if (!arcana) {
    return card.label
  }

  if (arcana.key === 'excuse') {
    return `${arcana.name} (Excuse)`
  }

  return `${arcana.roman} ${arcana.name} (Atout ${arcana.number})`
}

function getExpressionDirection(card: PromptCard) {
  const arcana = getTarotArcana(card.role, card.rank)

  if (arcana) {
    return `Facial expression must strictly match ${arcana.name}: ${arcana.expression} Do not default to a friendly smile unless the arcana requires joy.`
  }

  return 'Flattering natural expression matching the card role.'
}

const sharedArtConstraints = [
  'No text, no letters, no numbers, no card index, no suit pips.',
  'No painted frame, no border, no ornamental edge, no white margin, no passe-partout: the card frame is added afterwards.',
  'Full-bleed image to the edges.',
  'NOT cartoon, NOT comic-book, NOT cel-shaded, NOT thick black outlines, NOT manga or clip-art style.'
]

const premiumIllustrationStyle = [
  'premium European playing-card / Marseille-tarot illustration',
  'painterly refined shading, soft natural edges, print-ready card art',
  'no cartoon outlines, no comic ink lines, no flat cel shading'
]

/**
 * Legacy single-pass prompt (subject / context / style).
 * Kept for compatibility if a one-shot generation path is reintroduced.
 */
export function buildCardImagePrompt(card: PromptCard, settings: DeckStyleSettings, cardPrompt?: string | null) {
  const displayName = getCardDisplayName(card)

  return buildStructuredPrompt({
    subject: `A premium full-bleed playing-card illustration of the person from the reference photos as ${displayName}, clear likeness, centered bust or three-quarter portrait in the foreground.`,
    context: [
      getArcanaContext(card),
      getExpressionDirection(card),
      getRoleContext(card, settings),
      getSuitContext(card, settings),
      getSuitAccent(card, settings),
      cardPrompt,
      'Soft background behind the figure, simple decor, few accessories, readable at a glance.'
    ],
    style: [
      settings.visualStyle,
      ...getDeckArtDirection(settings),
      ...premiumIllustrationStyle,
      'cohesive premium card art, soft lighting, high detail on the face, quieter background'
    ],
    constraints: sharedArtConstraints
  })
}

/** Text-to-image only: empty scenic backdrop for the card window. */
export function buildCardScenePrompt(card: PromptCard, settings: DeckStyleSettings, cardPrompt?: string | null) {
  const displayName = getCardDisplayName(card)
  const arcana = getTarotArcana(card.role, card.rank)

  return buildStructuredPrompt({
    subject: arcana
      ? `An empty illustrated environment for the major-arcana playing card ${displayName}, atmosphere only, no people, no faces, no animals in the foreground.`
      : `An empty illustrated environment for the playing card ${displayName}, atmosphere only, no people, no faces, no animals in the foreground.`,
    context: [
      getArcanaContext(card),
      arcana ? `Evoke the symbolism and mood of ${arcana.name} through setting, light, and props only (${arcana.meaning}).` : null,
      getRoleContext(card, settings),
      getSuitContext(card, settings),
      getSuitAccent(card, settings),
      cardPrompt,
      'Soft depth, calm readable shapes, decor filling the whole frame, ready to sit behind a character cutout.',
      'Keep the centre of the image calm and slightly darker or lighter than the figure will be, so the character stands out; detail stays in the background.'
    ],
    style: [
      settings.visualStyle,
      ...getDeckArtDirection(settings),
      ...premiumIllustrationStyle,
      'gentle lighting, painterly background, edge-to-edge composition'
    ],
    constraints: sharedArtConstraints
  })
}

/**
 * The single back shared by every card of the deck.
 * Uses the deck colour theme so it matches the faces; the renderer adds the
 * same outer contour as the faces around it.
 */
export function buildCardBackPrompt(settings: DeckStyleSettings, cardBackPrompt?: string | null) {
  return buildStructuredPrompt({
    subject: 'A full-bleed ornamental playing-card back pattern, perfectly centered, symmetrical, edge-to-edge, no people, no faces, no animals, no letters, no numbers.',
    context: [
      settings.cardBackPrompt || cardBackPrompt,
      'Classic European card-back motif: repeating or radial ornament (sacred geometry, filigree, fleurs-de-lis, foliage or heraldic pattern) that covers the whole surface evenly.',
      'Exactly the same when rotated 180 degrees (point symmetry), so no card can be told apart from its back or its orientation.',
      'Medium density pattern, no single large focal illustration, no scene, no horizon.'
    ],
    style: [
      settings.visualStyle,
      ...getDeckArtDirection(settings),
      'flat, even lighting on the pattern, crisp print-ready ornament, cohesive with the deck faces'
    ],
    constraints: [
      ...sharedArtConstraints,
      'No portraits, no photos, no logos, no QR codes.',
      'No mockup, no isolated card on a background, no drop shadow, no rounded card corners drawn in the image.',
      'Pattern fills the entire image to the edges.'
    ]
  })
}

/** Image edit: likeness on pure chroma green for cutout. */
export function buildCardForegroundPrompt(card: PromptCard, settings: DeckStyleSettings, cardPrompt?: string | null) {
  const displayName = getCardDisplayName(card)
  const arcana = getTarotArcana(card.role, card.rank)

  return buildStructuredPrompt({
    subject: arcana
      ? `Transform the person from the reference photos into an illustrated embodiment of ${displayName}, keep a clear likeness consistent with all references, three-quarter or full figure with a readable silhouette.`
      : `Transform the person from the reference photos into an illustrated character for the playing card ${displayName}, keep a clear likeness consistent with all references, three-quarter or full figure with a readable silhouette.`,
    context: [
      getArcanaContext(card),
      getExpressionDirection(card),
      arcana
        ? `Costume, pose, and one symbolic prop must express ${arcana.name} (${arcana.meaning}). The mood of the portrait is as important as the costume.`
        : null,
      getRoleContext(card, settings),
      getSuitContext(card, settings),
      getSuitAccent(card, settings),
      cardPrompt,
      'Use every provided reference photo to lock identity: face shape, age, hair, glasses, and distinctive features.',
      arcana
        ? 'Character in the foreground only, minimal props, theatrical Marseille-tarot presence without clutter. This is a major arcana, not a suit card.'
        : 'Character in the foreground only, costume and pose matching the card role, minimal props.'
    ],
    style: [
      settings.visualStyle,
      ...getDeckArtDirection(settings),
      ...premiumIllustrationStyle,
      'clean silhouette edges, studio cutout look, refined costume rendering'
    ],
    constraints: [
      'Mandatory background: flat pure chroma-key green #00FF00 only, edge-to-edge, uniform, no texture, no scenery, no gradient, no green cast shadow.',
      'Character fully opaque against that green. Hard clean silhouette edges. Absolutely no green halo, fringe, glow, outline, or green contamination on hair, skin, clothes, or props.',
      'Never use bright or saturated green on the character (it would be keyed out): render any green of the palette as dark olive, bottle green or teal.',
      'Do not paint any card frame, border, number, letter, or suit pip.',
      'The figure may only be cropped by the bottom border (three-quarter framing); head, hands, cape, weapon, props and any horse or animal stay fully inside the left, right and top borders.',
      'Keep a clear band of pure green along the left, right and top borders, at least 5% of the image width.',
      'If a horse or large animal would not fit entirely, show only its head and neck beside the character, still fully inside the image.'
    ]
  })
}
