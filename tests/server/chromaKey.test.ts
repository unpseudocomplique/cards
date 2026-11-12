import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { removeChromaGreen } from '../../server/utils/cardRenderer'

const SIZE = 600

/**
 * Green screen with a brown figure; a strip of olive "spill" along its left
 * edge (hair blended with the green screen) and a bottle-green patch of
 * clothing well inside the figure.
 */
async function figureOnGreen() {
  const block = (width: number, height: number, background: string) =>
    ({ create: { width, height, channels: 3 as const, background } })

  return sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: '#00ff00' } })
    .composite([
      { input: block(360, 360, '#785032'), left: 120, top: 120 }, // brown hair / body (120, 80, 50)
      { input: block(8, 360, '#3c5a23'), left: 120, top: 120 }, // olive spill on the edge (60, 90, 35)
      { input: block(60, 60, '#144628'), left: 270, top: 270 } // bottle-green clothing (20, 70, 40)
    ])
    .png()
    .toBuffer()
}

async function rgba(image: Buffer, x: number, y: number) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const offset = (y * info.width + x) * 4
  return { r: data[offset]!, g: data[offset + 1]!, b: data[offset + 2]!, a: data[offset + 3]! }
}

describe('chroma key', () => {
  it('removes the green screen', async () => {
    const out = await removeChromaGreen(await figureOnGreen())
    expect((await rgba(out, 20, 20)).a).toBe(0)
  })

  it('neutralises dark green spill along the outline', async () => {
    const out = await removeChromaGreen(await figureOnGreen())

    for (const x of [122, 124, 126]) {
      const pixel = await rgba(out, x, 300)
      // Still part of the figure (edge pixels may be slightly transparent)…
      expect(pixel.a).toBeGreaterThan(150)
      // …but no longer tinted green.
      expect(pixel.g).toBeLessThanOrEqual(Math.max(pixel.r, pixel.b) + 1)
    }
  })

  it('keeps green clothing inside the figure', async () => {
    const out = await removeChromaGreen(await figureOnGreen())
    const pixel = await rgba(out, 300, 300)

    expect(pixel.a).toBe(255)
    expect(pixel.g).toBeGreaterThan(60)
    expect(pixel.g - Math.max(pixel.r, pixel.b)).toBeGreaterThan(20)
  })

  it('leaves the rest of the figure untouched', async () => {
    const out = await removeChromaGreen(await figureOnGreen())
    expect(await rgba(out, 200, 200)).toEqual({ r: 120, g: 80, b: 50, a: 255 })
  })
})
