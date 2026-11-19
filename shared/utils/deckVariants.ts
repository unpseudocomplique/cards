/**
 * Print variants: a variant is the whole deck, card for card, except the cards
 * it overrides (another person, another prompt, its own generated face). Cards
 * it does not override always show the deck's current face, so the variant
 * follows every change made to the deck.
 */

export const VARIANT_NAME_MAX = 60

type FaceSource = {
  status: string
  finalImageUrl: string | null
  metadata: { format?: string | null }
}

export type VariantBaseCard = FaceSource & {
  id: string
  cardCode: string
  metadata: FaceSource['metadata'] & { label: string, design?: 'classic' }
}

export type VariantOverride = FaceSource & {
  baseCardId: string
}

export type PrintFace<Card extends VariantBaseCard> = {
  card: Card
  finalImageUrl: string
  /** Classic pip face, redrawn as vector at print size. */
  classic: boolean
  /** Face comes from the variant, not from the deck. */
  overridden: boolean
}

function hasFaceInFormat(source: FaceSource, formatId: string) {
  // Faces without a recorded format predate formats: they are poker.
  return source.status === 'ready'
    && Boolean(source.finalImageUrl)
    && (source.metadata.format || 'poker') === formatId
}

/**
 * The faces of one printed version of the deck, in deck order.
 * - A card the version overrides must have its own face ready in the deck
 *   format: otherwise it is listed in `missing`, never replaced by the deck's
 *   face (that would print the wrong person).
 * - Other cards use the deck's face, and are skipped while it is not ready,
 *   like the base export always did.
 */
export function resolvePrintFaces<Card extends VariantBaseCard>(
  baseCards: Card[],
  overrides: VariantOverride[],
  formatId: string
) {
  const overrideByCard = new Map(overrides.map(override => [override.baseCardId, override]))
  const faces: Array<PrintFace<Card>> = []
  const missing: Card[] = []
  const skipped: Card[] = []

  for (const card of baseCards) {
    const override = overrideByCard.get(card.id)

    if (override) {
      if (hasFaceInFormat(override, formatId)) {
        faces.push({ card, finalImageUrl: override.finalImageUrl!, classic: false, overridden: true })
      } else {
        missing.push(card)
      }
      continue
    }

    if (hasFaceInFormat(card, formatId)) {
      faces.push({ card, finalImageUrl: card.finalImageUrl!, classic: card.metadata.design === 'classic', overridden: false })
    } else {
      skipped.push(card)
    }
  }

  return { faces, missing, skipped }
}

/** File-name friendly version of a name. */
export function slugifyName(value: string, fallback = 'jeu') {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || fallback
}

/** Distinct slugs for a list of names: "a", "a-2", "a-3"… */
export function uniqueSlugs(names: string[], taken: string[] = [], fallback = 'variante') {
  const used = new Set(taken)
  return names.map((name) => {
    const base = slugifyName(name, fallback)
    let slug = base
    let counter = 2
    while (used.has(slug)) {
      slug = `${base}-${counter}`
      counter += 1
    }
    used.add(slug)
    return slug
  })
}
