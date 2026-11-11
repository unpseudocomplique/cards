import { describe, expect, it } from 'vitest'
import { buildDeckTextureManifest } from '../../server/utils/deckTextures'

describe('buildDeckTextureManifest', () => {
  it('emits 78 entries and keeps null faces', () => {
    const manifest = buildDeckTextureManifest({
      deckId: 'deck-1',
      format: 'tarot',
      backUrl: 'https://cdn.example/back.png',
      backFormat: 'tarot',
      cards: [
        { cardCode: 'hearts-k', finalImageUrl: 'https://cdn.example/hearts-k.png', format: 'tarot' }
      ]
    })

    expect(manifest.deckId).toBe('deck-1')
    expect(manifest.format).toBe('tarot')
    expect(manifest.cardRatio).toBeCloseTo(61 / 112, 3)
    expect(manifest.backUrl).toBe('https://cdn.example/back.png')
    expect(manifest.cards).toHaveLength(78)

    const king = manifest.cards.find(card => card.cardCode === 'hearts-k')
    expect(king?.faceUrl).toBe('https://cdn.example/hearts-k.png')

    const trump = manifest.cards.find(card => card.cardCode === 'trump-21')
    expect(trump?.faceUrl).toBeNull()
  })

  it('drops faces and back rendered in another format', () => {
    const manifest = buildDeckTextureManifest({
      deckId: 'deck-1',
      format: 'tarot',
      backUrl: 'https://cdn.example/old-back.png',
      cards: [
        { cardCode: 'hearts-k', finalImageUrl: 'https://cdn.example/old.png' },
        { cardCode: 'spades-k', finalImageUrl: 'https://cdn.example/new.png', format: 'tarot' }
      ]
    })

    expect(manifest.backUrl).toBeNull()
    expect(manifest.cards.find(card => card.cardCode === 'hearts-k')?.faceUrl).toBeNull()
    expect(manifest.cards.find(card => card.cardCode === 'spades-k')?.faceUrl).toBe('https://cdn.example/new.png')
  })

  it('treats decks without a format as poker', () => {
    const manifest = buildDeckTextureManifest({
      deckId: 'deck-1',
      backUrl: 'https://cdn.example/back.png',
      cards: [{ cardCode: 'hearts-k', finalImageUrl: 'https://cdn.example/hearts-k.png' }]
    })

    expect(manifest.format).toBe('poker')
    expect(manifest.cardRatio).toBeCloseTo(3 / 4, 3)
    expect(manifest.backUrl).toBe('https://cdn.example/back.png')
    expect(manifest.cards.find(card => card.cardCode === 'hearts-k')?.faceUrl).toBe('https://cdn.example/hearts-k.png')
  })
})
