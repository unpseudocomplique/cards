import { describe, expect, it } from 'vitest'
import { resolveCopiedFaces } from '~~/shared/utils/deckCopy'

function card(id: string, extra: Partial<{ status: string, finalImageUrl: string | null, design: 'classic' }> = {}) {
  return {
    id,
    cardCode: `code-${id}`,
    status: extra.status ?? 'ready',
    finalImageUrl: extra.finalImageUrl === undefined ? `https://img/${id}.png` : extra.finalImageUrl,
    metadata: { format: 'tarot', ...(extra.design ? { design: extra.design, theme: 'royal' } : {}) }
  }
}

describe('resolveCopiedFaces', () => {
  const deck = [card('a', { design: 'classic' }), card('b'), card('c'), card('d', { status: 'pending', finalImageUrl: null })]

  it('copies every ready face of the deck by card code, with its format and classic design', () => {
    const faces = resolveCopiedFaces(deck)
    expect([...faces.keys()]).toEqual(['code-a', 'code-b', 'code-c'])
    expect(faces.get('code-a')).toEqual({ finalImageUrl: 'https://img/a.png', format: 'tarot', design: 'classic', theme: 'royal' })
    expect(faces.get('code-b')).toEqual({ finalImageUrl: 'https://img/b.png', format: 'tarot' })
  })

  it('uses the variant face for the cards it changes, without the classic flag', () => {
    const faces = resolveCopiedFaces(deck, [
      { baseCardId: 'a', status: 'ready', finalImageUrl: 'https://img/a-v.png', metadata: { format: 'tarot' } }
    ])
    expect(faces.get('code-a')).toEqual({ finalImageUrl: 'https://img/a-v.png', format: 'tarot' })
    expect(faces.get('code-b')?.finalImageUrl).toBe('https://img/b.png')
  })

  it('leaves a changed card empty while its variant face is not ready', () => {
    const faces = resolveCopiedFaces(deck, [
      { baseCardId: 'b', status: 'pending', finalImageUrl: null, metadata: {} }
    ])
    expect(faces.has('code-b')).toBe(false)
  })
})
