import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { getCardLayout, renderCardBackImage, renderCardImage, upscaleToPrintCanvas } from '../../server/utils/cardRenderer'
import { CARD_FORMATS, PRINT_SAFE_MM, cardFormatIds, getCanvasPx, mmToPx } from '../../shared/utils/printSpec'

function solid(color: string) {
  return sharp({ create: { width: 96, height: 128, channels: 4, background: color } }).png().toBuffer()
}

describe('cardRenderer', () => {
  it.each(cardFormatIds)('renders every face and the back of a %s deck at the same size', async (format) => {
    const scene = await solid('#6a7fa8')
    const foreground = await solid('#00ff00')
    const back = await renderCardBackImage(await solid('#1d2b4c'), { theme: 'royal', format })
    const faces = await Promise.all([
      renderCardImage(scene, { label: '10 de Coeurs', shortLabel: '10♥', rank: '10', role: 'number', suit: 'hearts' }, foreground, { theme: 'royal', format }),
      renderCardImage(scene, { label: 'Le Monde', shortLabel: '21', rank: '21', role: 'trump', suit: 'trumps' }, foreground, { theme: 'royal', format }),
      renderCardImage(scene, { label: 'Excuse', shortLabel: 'EX', role: 'excuse', suit: 'trumps' }, undefined, { theme: 'royal', format })
    ])
    const expected = getCanvasPx(CARD_FORMATS[format], 'screen')

    for (const image of [back, ...faces]) {
      const meta = await sharp(image).metadata()
      expect({ width: meta.width, height: meta.height }).toEqual({ width: expected.width, height: expected.height })
    }
  }, 60_000)

  it('renders tarot cards at 61 × 112 mm plus bleed for print', async () => {
    const image = await renderCardImage(await solid('#6a7fa8'), { label: 'Roi de Piques', shortLabel: 'R♠', rank: 'K', role: 'king', suit: 'spades' }, undefined, { profile: 'print', format: 'tarot' })
    const meta = await sharp(image).metadata()
    const bleed = mmToPx(3) * 2
    expect({ width: meta.width, height: meta.height }).toEqual({ width: mmToPx(61) + bleed, height: mmToPx(112) + bleed })
  }, 60_000)

  it('keeps the poker format for decks without one', async () => {
    const image = await renderCardImage(await solid('#6a7fa8'), { label: 'Roi de Piques', shortLabel: 'R♠', rank: 'K', role: 'king', suit: 'spades' }, undefined, { profile: 'print' })
    const meta = await sharp(image).metadata()
    const expected = getCanvasPx(CARD_FORMATS.poker, 'print')
    expect({ width: meta.width, height: meta.height }).toEqual({ width: expected.width, height: expected.height })
  }, 60_000)

  it('scales a tarot screen face to the tarot press canvas without distortion', async () => {
    const face = await renderCardImage(await solid('#6a7fa8'), { label: 'Dame de Coeurs', shortLabel: 'D♥', rank: 'Q', role: 'queen', suit: 'hearts' }, undefined, { format: 'tarot' })
    const print = await upscaleToPrintCanvas(face, 'royal', 'tarot')
    const meta = await sharp(print).metadata()
    const expected = getCanvasPx(CARD_FORMATS.tarot, 'print')
    expect({ width: meta.width, height: meta.height }).toEqual({ width: expected.width, height: expected.height })

    const screenRatio = CARD_FORMATS.tarot.screenPx.width / CARD_FORMATS.tarot.screenPx.height
    const trimRatio = CARD_FORMATS.tarot.trimMm.width / CARD_FORMATS.tarot.trimMm.height
    expect(Math.abs(screenRatio - trimRatio)).toBeLessThan(0.001)
  }, 60_000)

  it('keeps the tarot contour, indices and frame outside the print safe zone', () => {
    const layout = getCardLayout(CARD_FORMATS.tarot, 'print')
    const safe = mmToPx(PRINT_SAFE_MM)
    const fromCut = (value: number) => value - layout.bleed
    // Outer edge of the contour line.
    expect(fromCut(layout.contour.x - layout.contourStroke / 2)).toBeGreaterThanOrEqual(safe)
    expect(fromCut(layout.contour.y - layout.contourStroke / 2)).toBeGreaterThanOrEqual(safe)
    expect(fromCut(layout.index.x)).toBeGreaterThanOrEqual(safe)
    expect(fromCut(layout.index.y)).toBeGreaterThanOrEqual(safe)
    expect(fromCut(layout.window.x - layout.hairlineGap)).toBeGreaterThanOrEqual(safe)
    expect(fromCut(layout.foregroundTop)).toBeGreaterThanOrEqual(safe)
  })

  it('keeps the historical poker layout untouched', () => {
    const layout = getCardLayout(CARD_FORMATS.poker, 'screen')
    expect(layout.contour.x).toBe(31)
    expect(layout.index).toMatchObject({ x: 52, y: 63, width: 79 })
    expect(layout.window).toMatchObject({ x: 153, y: 63, width: 594, height: 1074 })
  })
})
