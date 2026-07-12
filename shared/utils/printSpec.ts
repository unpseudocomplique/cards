/**
 * Print pipeline constants for personalized playing cards.
 *
 * DO NOT change these without updating:
 * - `.cursor/rules/print-pipeline.mdc`
 * - `README.md` (section Impression)
 * - foil mask geometry in `server/utils/cardRenderer.ts`
 *
 * Physical sizes match common European / poker stock.
 * All print exports use 300 DPI + 3 mm bleed.
 */

export const PRINT_DPI = 300
export const PRINT_BLEED_MM = 3

/** Poker / enseignes (classic 52, tarot 56, minor arcana): 63.5 × 88.9 mm */
export const POKER_TRIM_MM = { width: 63.5, height: 88.9 } as const

/**
 * Major arcana / Excuse (9:16): 70 × 124.4 mm (exact 9:16 of 70 mm width).
 * Confirm with the printer before a large run.
 */
export const TAROT_TRIM_MM = { width: 70, height: 124.4 } as const

/** Screen preview canvases (fast UI / regenerate). Not for press. */
export const SCREEN_POKER_PX = { width: 900, height: 1200 } as const
export const SCREEN_TAROT_PX = { width: 900, height: 1600 } as const

export type PrintAspectRatio = '3:4' | '9:16'
export type RenderProfile = 'screen' | 'print'

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
  pokerTrimMm: POKER_TRIM_MM,
  tarotTrimMm: TAROT_TRIM_MM,
  colorSpace: 'sRGB PNG (convert to CMYK at the printer if required)',
  foilMask: 'Black = hot-foil stamp area; white = no foil. Separate PNG per card.',
  files: {
    faces: 'print/faces/{cardCode}.png',
    foil: 'print/foil/{cardCode}-foil.png',
    back: 'print/back/card-back.png',
    backFoil: 'print/back/card-back-foil.png',
    spec: 'print/print-spec.json'
  }
} as const
