import type { DeckStyleSettings } from '~~/server/database/schema'
import type { CardPromptRole, CardPromptSuit } from '~~/shared/utils/cardPromptPresets'
import { cardPromptRoleValues, cardPromptSuitValues, mergeRolePrompts, mergeSuitPrompts } from '~~/shared/utils/cardPromptPresets'
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
  'No painted frame, no gold or black border, no ornamental edge, no white margin, no passe-partout.',
  'Full-bleed image to the edges.'
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
      cardPrompt,
      'Soft background behind the figure, simple decor, few accessories, readable at a glance.'
    ],
    style: [
      settings.visualStyle,
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
      cardPrompt,
      'Soft depth, calm readable shapes, decor filling the whole frame, ready to sit behind a character cutout.'
    ],
    style: [
      settings.visualStyle,
      'premium digital illustration, gentle lighting, painterly background, edge-to-edge composition'
    ],
    constraints: sharedArtConstraints
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
      cardPrompt,
      'Use every provided reference photo to lock identity: face shape, age, hair, glasses, and distinctive features.',
      arcana
        ? 'Character in the foreground only, minimal props, theatrical Marseille-tarot presence without clutter. This is a major arcana, not a suit card.'
        : 'Character in the foreground only, costume and pose matching the card role, minimal props.'
    ],
    style: [
      settings.visualStyle,
      'premium digital illustration, clean edges, studio cutout look'
    ],
    constraints: [
      'Mandatory background: flat pure chroma-key green #00FF00, uniform, no texture, no scenery, no green cast shadow.',
      'Sharp silhouette against the green, no green halo, fringe, glow, or outline, and no green contamination on hair, skin, or clothes.',
      'No text, no letters, no numbers, no card index, no suit pips, no frame, no border.'
    ]
  })
}
