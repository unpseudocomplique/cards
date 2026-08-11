import type { CardId } from '~~/shared/tarot'

const SUIT_COLORS: Record<string, string> = {
  hearts: '#b91c1c',
  diamonds: '#b91c1c',
  clubs: '#111827',
  spades: '#111827',
  trump: '#a16207',
  excuse: '#a16207',
}

export function placeholderLabel(cardCode: string): string {
  if (cardCode === 'excuse') {
    return 'Exc'
  }
  if (cardCode.startsWith('trump-')) {
    return cardCode.replace('trump-', '')
  }
  const [suit, rank] = cardCode.split('-')
  const symbol = ({ hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' } as Record<string, string>)[suit ?? ''] ?? '?'
  return `${(rank ?? '?').toUpperCase()}${symbol}`
}

export function placeholderColor(cardCode: string): string {
  if (cardCode === 'excuse' || cardCode.startsWith('trump-')) {
    return SUIT_COLORS.trump!
  }
  const suit = cardCode.split('-')[0] ?? ''
  return SUIT_COLORS[suit] ?? '#334155'
}

/** Create a small canvas texture bitmap for missing S3 faces (browser only). */
export function createPlaceholderImageBitmap(cardCode: CardId | string, size = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = placeholderColor(cardCode)
  ctx.lineWidth = 8
  ctx.strokeRect(12, 12, size - 24, size - 24)
  ctx.fillStyle = placeholderColor(cardCode)
  ctx.font = `bold ${Math.floor(size / 5)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(placeholderLabel(cardCode), size / 2, size / 2)
  return canvas
}
