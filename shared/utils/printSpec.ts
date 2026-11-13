/**
 * Print pipeline constants for personalized playing cards.
 *
 * DO NOT change these without updating:
 * - `.cursor/rules/print-pipeline.mdc`
 * - `README.md` (section Impression)
 * - `docs/print-pipeline.md`
 *
 * A deck has exactly one card format: every face (figures, numerals, trumps,
 * Excuse) and its single back share the same size and contour.
 * All print exports use 300 DPI + 3 mm bleed, in CMYK (FOGRA39), as PDF with
 * crop marks: one PDF for every face (one card per page), one PDF for the back.
 */

export const PRINT_DPI = 300
export const PRINT_BLEED_MM = 3
/**
 * Safe zone inside the trim: the cut can drift by about a millimetre, so the
 * contour line, the indices and the illustration frame stay at least this far
 * from the cut line (applies to the tarot layout; see getCardLayoutRatios).
 */
export const PRINT_SAFE_MM = 3

/**
 * Printer PDF page: the card with its bleed, surrounded by a slug that holds
 * the crop marks. Marks are aligned on the trim lines and start outside the
 * bleed so they never print on the card.
 */
export const PRINT_SLUG_MM = 10
export const PRINT_CROP_MARK_OFFSET_MM = PRINT_BLEED_MM
export const PRINT_CROP_MARK_LENGTH_MM = 5
export const PRINT_CROP_MARK_STROKE_PT = 0.25

/** CMYK press profile (server/assets/icc), also the PDF OutputIntent. */
export const PRINT_ICC_PROFILE = {
  file: 'FOGRA39L_coated.icc',
  identifier: 'FOGRA39',
  description: 'Coated FOGRA39 (ISO 12647-2:2004)'
} as const

export const cardFormatIds = ['poker', 'tarot'] as const
export type CardFormatId = typeof cardFormatIds[number]

/** Ratios the image model accepts (Gemini image generation). */
export type ArtAspectRatio = '2:3' | '3:4' | '9:16'

export type RenderProfile = 'screen' | 'print'

/**
 * - `side`: index corners in a column beside the illustration (wide cards).
 * - `band`: index corners above / below the illustration (tall tarot cards),
 *   so the illustration keeps a usable width.
 */
export type CardLayoutKind = 'side' | 'band'

export type CardFormat = {
  id: CardFormatId
  label: string
  /** Finished card size after cutting. */
  trimMm: { width: number, height: number }
  /** Screen render canvas (app, 3D table). Not for press. */
  screenPx: { width: number, height: number }
  /** Ratio asked to the image model for the scene and the character. */
  artAspectRatio: ArtAspectRatio
  /** Ratio asked to the image model for the back pattern. */
  backAspectRatio: ArtAspectRatio
  layout: CardLayoutKind
}

export const CARD_FORMATS: Record<CardFormatId, CardFormat> = {
  /** European poker stock. Classic 52-card decks, and decks created before tarot formats existed. */
  poker: {
    id: 'poker',
    label: 'Poker',
    trimMm: { width: 63.5, height: 88.9 },
    // Historical 3:4 screen canvas, kept so existing faces stay valid.
    screenPx: { width: 900, height: 1200 },
    artAspectRatio: '3:4',
    backAspectRatio: '3:4',
    layout: 'side'
  },
  /** French tarot stock (61 × 112 mm). Tarot 56 and tarot 78 decks. */
  tarot: {
    id: 'tarot',
    label: 'Tarot français',
    trimMm: { width: 61, height: 112 },
    // Same proportions as the trim: 900 / 1652 ≈ 61 / 112.
    screenPx: { width: 900, height: 1652 },
    artAspectRatio: '2:3',
    backAspectRatio: '9:16',
    layout: 'band'
  }
}

export function isCardFormatId(value: unknown): value is CardFormatId {
  return typeof value === 'string' && (cardFormatIds as readonly string[]).includes(value)
}

export function getCardFormat(id?: string | null): CardFormat {
  return CARD_FORMATS[isCardFormatId(id) ? id : 'poker']
}

/** Format given to a new deck of this type. */
export function defaultCardFormatForDeckType(deckType: string): CardFormatId {
  return deckType === 'classic52' ? 'poker' : 'tarot'
}

/** Formats a deck of this type may use. */
export function allowedCardFormatsForDeckType(deckType: string): CardFormatId[] {
  return deckType === 'classic52' ? ['poker'] : ['tarot', 'poker']
}

/** Format a deck renders in. Decks created before formats existed have none and stay poker. */
export function resolveDeckCardFormat(settings?: { cardFormat?: string | null } | null): CardFormat {
  return getCardFormat(settings?.cardFormat)
}

/** Format a stored face was rendered in. Faces generated before formats existed are poker. */
export function resolveCardImageFormat(metadata?: { format?: string | null } | null): CardFormat {
  return getCardFormat(metadata?.format)
}

/** Width / height of a format, for previews. */
export function cardFormatRatio(format: CardFormat) {
  return format.screenPx.width / format.screenPx.height
}

export function formatTrimLabel(format: CardFormat) {
  const mm = (value: number) => String(value).replace('.', ',')
  return `${mm(format.trimMm.width)} × ${mm(format.trimMm.height)} mm`
}

export function mmToPx(mm: number, dpi = PRINT_DPI) {
  return Math.round((mm / 25.4) * dpi)
}

export function getBleedPx(dpi = PRINT_DPI) {
  return mmToPx(PRINT_BLEED_MM, dpi)
}

export function getTrimPx(format: CardFormat, dpi = PRINT_DPI) {
  return {
    width: mmToPx(format.trimMm.width, dpi),
    height: mmToPx(format.trimMm.height, dpi)
  }
}

/** Full press canvas = trim + bleed on every side. */
export function getPrintCanvasPx(format: CardFormat, dpi = PRINT_DPI) {
  const trim = getTrimPx(format, dpi)
  const bleed = getBleedPx(dpi)

  return {
    width: trim.width + bleed * 2,
    height: trim.height + bleed * 2,
    trimWidth: trim.width,
    trimHeight: trim.height,
    bleed,
    dpi
  }
}

export function getCanvasPx(format: CardFormat, profile: RenderProfile) {
  if (profile === 'print') {
    const canvas = getPrintCanvasPx(format)

    return { width: canvas.width, height: canvas.height, bleed: canvas.bleed }
  }

  return { width: format.screenPx.width, height: format.screenPx.height, bleed: 0 }
}

/**
 * Card anatomy as fractions of the trim width, shared by the server renderer
 * (server/utils/cardRenderer.ts) and the CSS preview (app/components/CardArt.vue)
 * so both draw the same card.
 */
export type CardLayoutRatios = {
  layout: CardLayoutKind
  /** Outer contour line, same on faces and back. */
  contourInset: number
  contourStroke: number
  contourRadius: number
  /** Screen corner radius (print keeps square bleed edges). */
  cardRadius: number
  indexX: number
  indexY: number
  indexWidth: number
  rankHeight: number
  pipSize: number
  indexGap: number
  /** Side: gap between the index column and the window. Band: gap under the index block. */
  windowGap: number
  /** Band only: left / right inset of the window. */
  windowX: number
  windowRadius: number
  frameStroke: number
  hairlineStroke: number
  hairlineGap: number
  /** Band only: how far below the index block the character may rise. */
  foregroundGap: number
}

const sideLayoutRatios: CardLayoutRatios = {
  layout: 'side',
  contourInset: 0.034,
  contourStroke: 0.005,
  contourRadius: 0.03,
  cardRadius: 0.05,
  indexX: 0.058,
  indexY: 0.07,
  indexWidth: 0.088,
  rankHeight: 0.07,
  pipSize: 0.056,
  indexGap: 0.02,
  windowGap: 0.024,
  windowX: 0,
  windowRadius: 0.018,
  frameStroke: 0.006,
  hairlineStroke: 0.0025,
  hairlineGap: 0.01,
  foregroundGap: 0
}

export function getCardLayoutRatios(format: CardFormat): CardLayoutRatios {
  // Poker keeps its historical layout so existing decks stay homogeneous.
  if (format.layout === 'side') {
    return sideLayoutRatios
  }

  // Tarot: placed in millimetres from the cut, outside the safe zone.
  const mm = (value: number) => value / format.trimMm.width
  const contourInset = mm(PRINT_SAFE_MM + 0.5)
  const indexX = contourInset + mm(1.4)

  return {
    ...sideLayoutRatios,
    layout: 'band',
    contourInset,
    indexX,
    indexY: contourInset + mm(1.8),
    windowX: indexX,
    windowGap: mm(2.4),
    foregroundGap: mm(0.7)
  }
}

export function getPrintSpecSummary(format: CardFormat) {
  return {
    dpi: PRINT_DPI,
    bleedMm: PRINT_BLEED_MM,
    // Only formats with a safe-zone layout (tarot) guarantee it.
    safeZoneMm: format.layout === 'band' ? PRINT_SAFE_MM : null,
    format: format.id,
    trimMm: format.trimMm,
    colorSpace: `CMYK, ${PRINT_ICC_PROFILE.description} (PDF OutputIntent)`,
    cropMarks: {
      offsetMm: PRINT_CROP_MARK_OFFSET_MM,
      lengthMm: PRINT_CROP_MARK_LENGTH_MM,
      strokePt: PRINT_CROP_MARK_STROKE_PT
    },
    pageMm: {
      width: format.trimMm.width + PRINT_SLUG_MM * 2,
      height: format.trimMm.height + PRINT_SLUG_MM * 2
    },
    files: {
      recto: 'recto.pdf (une carte par page)',
      verso: 'verso.pdf (dos commun à toutes les cartes)',
      spec: 'print-spec.json'
    }
  } as const
}
