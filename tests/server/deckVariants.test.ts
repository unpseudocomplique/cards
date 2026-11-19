import { describe, expect, it } from 'vitest'
import { resolvePrintFaces, uniqueSlugs } from '~~/shared/utils/deckVariants'

function card(id: string, extra: Partial<{ status: string, finalImageUrl: string | null, format: string, design: 'classic' }> = {}) {
  return {
    id,
    cardCode: id,
    status: extra.status ?? 'ready',
    finalImageUrl: extra.finalImageUrl === undefined ? `https://img/${id}.png` : extra.finalImageUrl,
    metadata: { label: `Carte ${id}`, format: extra.format ?? 'tarot', design: extra.design }
  }
}

describe('resolvePrintFaces', () => {
  const deck = [card('a', { design: 'classic' }), card('b'), card('c'), card('d', { status: 'pending', finalImageUrl: null })]

  it('prints the deck faces in order and skips the cards not ready yet', () => {
    const result = resolvePrintFaces(deck, [], 'tarot')
    expect(result.faces.map(face => face.card.id)).toEqual(['a', 'b', 'c'])
    expect(result.faces[0]!.classic).toBe(true)
    expect(result.skipped.map(entry => entry.id)).toEqual(['d'])
    expect(result.missing).toEqual([])
  })

  it('replaces only the overridden cards and follows the deck for the others', () => {
    const result = resolvePrintFaces(deck, [
      { baseCardId: 'c', status: 'ready', finalImageUrl: 'https://img/c-variant.png', metadata: { format: 'tarot' } }
    ], 'tarot')
    expect(result.faces.map(face => face.finalImageUrl)).toEqual([
      'https://img/a.png',
      'https://img/b.png',
      'https://img/c-variant.png'
    ])
    expect(result.faces.map(face => face.overridden)).toEqual([false, false, true])
  })

  it('never falls back to the deck face for an override without its own face', () => {
    const result = resolvePrintFaces(deck, [
      { baseCardId: 'b', status: 'pending', finalImageUrl: null, metadata: {} },
      { baseCardId: 'c', status: 'ready', finalImageUrl: 'https://img/c-old.png', metadata: { format: 'poker' } }
    ], 'tarot')
    expect(result.faces.map(face => face.card.id)).toEqual(['a'])
    expect(result.missing.map(entry => entry.id)).toEqual(['b', 'c'])
  })

  it('prints an override even when the deck card is not generated yet', () => {
    const result = resolvePrintFaces(deck, [
      { baseCardId: 'd', status: 'ready', finalImageUrl: 'https://img/d-variant.png', metadata: { format: 'tarot' } }
    ], 'tarot')
    expect(result.faces.map(face => face.card.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('treats faces without a format as poker', () => {
    const legacy = [{ ...card('x'), metadata: { label: 'X' } }]
    expect(resolvePrintFaces(legacy, [], 'poker').faces).toHaveLength(1)
    expect(resolvePrintFaces(legacy, [], 'tarot').faces).toHaveLength(0)
  })
})

describe('uniqueSlugs', () => {
  it('keeps file names distinct', () => {
    expect(uniqueSlugs(['Famille Martin', 'famille martin', 'Été'])).toEqual(['famille-martin', 'famille-martin-2', 'ete'])
    expect(uniqueSlugs(['!!!'])).toEqual(['variante'])
  })
})
