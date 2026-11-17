import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { getPipCount, renderClassicCardImage } from '../../server/utils/cardRenderer'
import { resolvePipCardStyle, usesClassicDesign } from '../../shared/utils/classicCards'
import { CARD_FORMATS, cardFormatIds, getCanvasPx } from '../../shared/utils/printSpec'

describe('classic pip cards', () => {
  it('only aces and numerals use the classic design, and only when the deck asks for it', () => {
    const classic = { pipCardStyle: 'classic' as const }
    expect(usesClassicDesign('number', classic)).toBe(true)
    expect(usesClassicDesign('ace', classic)).toBe(true)
    for (const role of ['jack', 'knight', 'queen', 'king', 'trump', 'excuse']) {
      expect(usesClassicDesign(role, classic)).toBe(false)
    }
    expect(usesClassicDesign('number', { pipCardStyle: 'illustrated' })).toBe(false)
    // Decks created before the option keep their illustrated numerals.
    expect(resolvePipCardStyle({})).toBe('illustrated')
  })

  it('counts pips from the rank', () => {
    expect(getPipCount({ label: 'As', shortLabel: 'A♠', rank: 'A', role: 'ace', suit: 'spades' })).toBe(1)
    expect(getPipCount({ label: '10', shortLabel: '10♥', rank: '10', role: 'number', suit: 'hearts' })).toBe(10)
    expect(getPipCount({ label: '1', shortLabel: '1♣', rank: '1', role: 'number', suit: 'clubs' })).toBe(1)
    expect(getPipCount({ label: 'Roi', shortLabel: 'R♠', rank: 'K', role: 'king', suit: 'spades' })).toBeNull()
  })

  it.each(cardFormatIds)('draws %s pip cards at the deck size, screen and print', async (format) => {
    for (const profile of ['screen', 'print'] as const) {
      const image = await renderClassicCardImage(
        { label: '7 de Trèfles', shortLabel: '7♣', rank: '7', role: 'number', suit: 'clubs' },
        { theme: 'foret', format, profile }
      )
      const meta = await sharp(image).metadata()
      const expected = getCanvasPx(CARD_FORMATS[format], profile)
      expect({ width: meta.width, height: meta.height }).toEqual({ width: expected.width, height: expected.height })
    }
  }, 60_000)
})
