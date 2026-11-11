import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { renderCardBackImage, renderCardImage } from '../../server/utils/cardRenderer'
import { getCanvasPx } from '../../shared/utils/printSpec'

function solid(color: string) {
  return sharp({ create: { width: 96, height: 128, channels: 4, background: color } }).png().toBuffer()
}

describe('cardRenderer', () => {
  it('renders every face and the back in the same deck format', async () => {
    const scene = await solid('#6a7fa8')
    const foreground = await solid('#00ff00')
    const back = await renderCardBackImage(await solid('#1d2b4c'), { theme: 'royal' })
    const faces = await Promise.all([
      renderCardImage(scene, { label: '10 de Coeurs', shortLabel: '10♥', rank: '10', role: 'number', suit: 'hearts' }, foreground, { theme: 'royal' }),
      renderCardImage(scene, { label: 'Le Monde', shortLabel: '21', rank: '21', role: 'trump', suit: 'trumps', aspectRatio: '9:16' }, foreground, { theme: 'royal' }),
      renderCardImage(scene, { label: 'Excuse', shortLabel: 'EX', role: 'excuse', suit: 'trumps' }, undefined, { theme: 'royal' })
    ])
    const expected = getCanvasPx('3:4', 'screen')

    for (const image of [back, ...faces]) {
      const meta = await sharp(image).metadata()
      expect({ width: meta.width, height: meta.height }).toEqual({ width: expected.width, height: expected.height })
    }
  }, 60_000)

  it('keeps bleed on print renders', async () => {
    const image = await renderCardImage(await solid('#6a7fa8'), { label: 'Roi de Piques', shortLabel: 'R♠', rank: 'K', role: 'king', suit: 'spades' }, undefined, { profile: 'print' })
    const meta = await sharp(image).metadata()
    const expected = getCanvasPx('3:4', 'print')
    expect({ width: meta.width, height: meta.height }).toEqual({ width: expected.width, height: expected.height })
  }, 60_000)
})
