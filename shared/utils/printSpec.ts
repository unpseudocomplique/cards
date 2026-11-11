/**
 * Print pipeline constants for personalized playing cards.
 *
 * DO NOT change these without updating:
 * - `.cursor/rules/print-pipeline.mdc`
 * - `README.md` (section Impression)
 * - `docs/print-pipeline.md`
 *
 * Physical sizes match common European / poker stock.
 * All print exports use 300 DPI + 3 mm bleed.
 */

export const PRINT_DPI = 300
export const PRINT_BLEED_MM = 3

/** Poker / enseignes (classic 52, tarot 56, minor arcana): 63.5 × 88.9 mm */
export const POKER_TRIM_MM = { width: 63.5, height: 88.9 } as const

/**
 * Legacy 9:16 trim (former major-arcana format). Kept for old card metadata only:
 * every card of a deck is now rendered in DECK_CARD_ASPECT_RATIO.
 */
export const TAROT_TRIM_MM = { width: 70, height: 124.4 } as const

/** Screen preview canvases (fast UI / regenerate). Not for press. */
export const SCREEN_POKER_PX = { width: 900, height: 1200 } as const
export const SCREEN_TAROT_PX = { width: 900, height: 1600 } as const

export type PrintAspectRatio = '3:4' | '9:16'
export type RenderProfile = 'screen' | 'print'

/**
 * Single card format for every card of every deck (faces, trumps, Excuse and back).
 * A deck must be uniform: same size, same contour, one identical back for all cards.
 */
export const DECK_CARD_ASPECT_RATIO = '3:4' as const satisfies PrintAspectRatio
export const DECK_TRIM_MM = POKER_TRIM_MM

export function mmToPx(mm: number, dpi = PRINT_DPI) {
  return Math.round((mm / 25.4) * dpi)
}

export function getTrimMm(aspectRatio: PrintAspectRatio) {
  return aspectRatio === '9:16' ? TAROT_TRIM_MM : POKER_TRIM_MM
}

export function getBleedPx(dpi = PRINT_DPI) {
  return mmToPx(PRINT_BLEED_MM, dpi)
}

export function getTrimPx(aspectRatio: PrintAspectRatio, dpi = PRINT_DPI) {
  const trim = getTrimMm(aspectRatio)

  return {
    width: mmToPx(trim.width, dpi),
    height: mmToPx(trim.height, dpi)
  }
}

/** Full press canvas = trim + bleed on every side. */
export function getPrintCanvasPx(aspectRatio: PrintAspectRatio, dpi = PRINT_DPI) {
  const trim = getTrimPx(aspectRatio, dpi)
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

export function getScreenCanvasPx(aspectRatio: PrintAspectRatio) {
  return aspectRatio === '9:16' ? SCREEN_TAROT_PX : SCREEN_POKER_PX
}

export function getCanvasPx(aspectRatio: PrintAspectRatio, profile: RenderProfile) {
  if (profile === 'print') {
    const canvas = getPrintCanvasPx(aspectRatio)

    return { width: canvas.width, height: canvas.height, bleed: canvas.bleed }
  }

  const screen = getScreenCanvasPx(aspectRatio)

  return { width: screen.width, height: screen.height, bleed: 0 }
}

export const PRINT_SPEC_SUMMARY = {
  dpi: PRINT_DPI,
  bleedMm: PRINT_BLEED_MM,
  aspectRatio: DECK_CARD_ASPECT_RATIO,
  trimMm: DECK_TRIM_MM,
  colorSpace: 'sRGB PNG (convert to CMYK at the printer if required)',
  files: {
    faces: 'print/faces/{cardCode}.png',
    back: 'print/back/card-back.png',
    spec: 'print/print-spec.json'
  }
} as const
