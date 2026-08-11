import { describe, expect, it } from 'vitest'
import { buildDeckTextureManifest } from '../../server/utils/deckTextures'

describe('buildDeckTextureManifest', () => {
  it('emits 78 entries and keeps null faces', () => {
    const manifest = buildDeckTextureManifest({
      deckId: 'deck-1',
      backUrl: 'https://cdn.example/back.png',
      cards: [
        { cardCode: 'hearts-k', finalImageUrl: 'https://cdn.example/hearts-k.png', aspectRatio: '3:4' },
      ],
    })

    expect(manifest.deckId).toBe('deck-1')
    expect(manifest.backUrl).toBe('https://cdn.example/back.png')
    expect(manifest.cards).toHaveLength(78)

    const king = manifest.cards.find(card => card.cardCode === 'hearts-k')
    expect(king).toEqual({
      cardCode: 'hearts-k',
      faceUrl: 'https://cdn.example/hearts-k.png',
      aspectRatio: '3:4',
    })

    const trump = manifest.cards.find(card => card.cardCode === 'trump-21')
    expect(trump?.faceUrl).toBeNull()
    expect(trump?.aspectRatio).toBe('9:16')

    const excuse = manifest.cards.find(card => card.cardCode === 'excuse')
    expect(excuse?.aspectRatio).toBe('9:16')
  })
})
