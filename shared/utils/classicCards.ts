/**
 * Pip cards (aces and numerals) get a classic, ready-made design by default:
 * suit symbols laid out the traditional way inside the deck frame, no AI image
 * and no person. Only trumps, the Excuse and the court cards are illustrated.
 */

export const pipCardStyles = ['classic', 'illustrated'] as const

export type PipCardStyle = typeof pipCardStyles[number]

/** Roles that can use the classic design. */
export const pipCardRoles = ['ace', 'number'] as const

/**
 * New decks are created with 'classic'. Decks created before this option keep
 * their illustrated aces and numerals until the style is switched by hand, so
 * no generated image is ever replaced behind the user's back.
 */
export function resolvePipCardStyle(settings?: { pipCardStyle?: PipCardStyle | null } | null): PipCardStyle {
  return settings?.pipCardStyle === 'classic' ? 'classic' : 'illustrated'
}

export function isPipCardRole(role?: string | null) {
  return role === 'ace' || role === 'number' || !role
}

/** True when this card is drawn by the classic renderer instead of the AI pipeline. */
export function usesClassicDesign(
  role: string | null | undefined,
  settings?: { pipCardStyle?: PipCardStyle | null } | null
) {
  return isPipCardRole(role) && resolvePipCardStyle(settings) === 'classic'
}
