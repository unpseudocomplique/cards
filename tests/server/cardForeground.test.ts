import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { detectEdgeContact, getCardLayout, placeForeground, renderCardImage } from '../../server/utils/cardRenderer'
import { CARD_FORMATS } from '../../shared/utils/printSpec'

const W = 400
const H = 600

/** Transparent canvas with one opaque block (a stand-in for a cut-out figure). */
function cutout(block: { left: number, top: number, width: number, height: number }) {
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{
      input: { create: { width: block.width, height: block.height, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } },
      left: block.left,
      top: block.top
    }])
    .png()
    .toBuffer()
}

/** Same block on chroma green, as the image model returns it. */
function chromaFigure(block: { left: number, top: number, width: number, height: number }) {
  return sharp({ create: { width: W, height: H, channels: 3, background: '#00ff00' } })
    .composite([{
      input: { create: { width: block.width, height: block.height, channels: 3, background: '#c81e1e' } },
      left: block.left,
      top: block.top
    }])
    .png()
    .toBuffer()
}

async function pixel(image: Buffer, x: number, y: number) {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const offset = (Math.round(y) * info.width + Math.round(x)) * info.channels
  return { r: data[offset]!, g: data[offset + 1]!, b: data[offset + 2]! }
}

describe('character layer edges', () => {
  it('detects a figure that stays inside its image', async () => {
    expect(await detectEdgeContact(await cutout({ left: 100, top: 100, width: 200, height: 400 })))
      .toEqual({ top: false, right: false, bottom: false, left: false })
  })

  it('detects a horse cut by the right and top borders', async () => {
    expect(await detectEdgeContact(await cutout({ left: 150, top: 0, width: 250, height: 500 })))
      .toEqual({ top: true, right: true, bottom: false, left: false })
  })

  it('ignores a few stray pixels on a border', async () => {
    expect(await detectEdgeContact(await cutout({ left: 0, top: 300, width: 2, height: 4 })))
      .toMatchObject({ left: false })
  })

  describe('placement in a tarot window', () => {
    const layout = getCardLayout(CARD_FORMATS.tarot, 'screen')
    const innerLeft = layout.window.x + layout.frameStroke
    const innerRight = layout.window.x + layout.window.width - layout.frameStroke
    const innerTop = layout.window.y + layout.frameStroke
    const innerBottom = layout.window.y + layout.window.height - layout.frameStroke
    const figure = { width: 300, height: 560 }
    const none = { top: false, right: false, bottom: false, left: false }

    it('centres a whole figure on the bottom edge, inside the window', () => {
      const place = placeForeground(figure, none, layout)
      expect(place.top + place.height).toBe(innerBottom)
      expect(place.left).toBeGreaterThan(innerLeft)
      expect(place.left + place.width).toBeLessThan(innerRight)
      expect(Math.abs(place.left + place.width / 2 - (innerLeft + innerRight) / 2)).toBeLessThanOrEqual(1)
    })

    it('lays a right-hand cut on the right frame', () => {
      const place = placeForeground(figure, { ...none, right: true }, layout)
      expect(place.left + place.width).toBe(innerRight)
    })

    it('lays a left-hand cut on the left frame', () => {
      const place = placeForeground(figure, { ...none, left: true }, layout)
      expect(place.left).toBe(innerLeft)
    })

    it('lays a top cut on the top frame and stops the pop-out there', () => {
      const place = placeForeground(figure, { ...none, top: true }, layout)
      expect(place.top).toBe(innerTop)
      expect(place.clip.top).toBe(innerTop)
    })

    it('spans the full width when cut on both sides', () => {
      const place = placeForeground(figure, { ...none, left: true, right: true }, layout)
      expect(place.left).toBe(innerLeft)
      expect(place.width).toBe(innerRight - innerLeft)
    })
  })

  it('renders a horse cut by the image border right up to the frame', async () => {
    const scene = await sharp({ create: { width: 96, height: 128, channels: 3, background: '#6a7fa8' } }).png().toBuffer()
    const layout = getCardLayout(CARD_FORMATS.tarot, 'screen')
    const innerRight = layout.window.x + layout.window.width - layout.frameStroke
    const innerBottom = layout.window.y + layout.window.height - layout.frameStroke
    const card = { label: 'Cavalier de Carreaux', shortLabel: 'C♦', rank: 'C', role: 'knight', suit: 'diamonds' }

    // Figure running into the right border of its image (horse cropped by the model).
    const cut = await renderCardImage(scene, card, await chromaFigure({ left: 120, top: 150, width: 280, height: 450 }), { theme: 'royal', format: 'tarot' })
    const atFrame = await pixel(cut, innerRight - 4, innerBottom - 40)
    expect(atFrame.r).toBeGreaterThan(150)
    expect(atFrame.b).toBeLessThan(100)

    // Whole figure: the scene still shows between the figure and the frame.
    const whole = await renderCardImage(scene, card, await chromaFigure({ left: 120, top: 150, width: 160, height: 450 }), { theme: 'royal', format: 'tarot' })
    const beside = await pixel(whole, innerRight - 4, innerBottom - 40)
    expect(beside.b).toBeGreaterThan(130)
  }, 60_000)
})
