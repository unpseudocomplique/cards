import type { CardId } from '~~/shared/tarot'

const SUIT_COLORS: Record<string, string> = {
  hearts: '#9f1239',
  diamonds: '#9f1239',
  clubs: '#1c1917',
  spades: '#1c1917',
  trump: '#92400e',
  excuse: '#92400e',
}

const SUIT_MARK: Record<string, string> = {
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
  spades: 'S',
}

export function placeholderLabel(cardCode: string): string {
  if (cardCode === 'excuse') {
    return 'Exc'
  }
  if (cardCode.startsWith('trump-')) {
    return cardCode.replace('trump-', '')
  }
  const [suit, rank] = cardCode.split('-')
  const mark = SUIT_MARK[suit ?? ''] ?? '?'
  return `${(rank ?? '?').toUpperCase()}${mark}`
}

export function placeholderColor(cardCode: string): string {
  if (cardCode === 'excuse' || cardCode.startsWith('trump-')) {
    return SUIT_COLORS.trump!
  }
  const suit = cardCode.split('-')[0] ?? ''
  return SUIT_COLORS[suit] ?? '#334155'
}

function parseCard(cardCode: string): { kind: 'trump' | 'excuse' | 'suit', rank: string, suit: string, color: string } {
  if (cardCode === 'excuse') {
    return { kind: 'excuse', rank: '★', suit: 'excuse', color: SUIT_COLORS.excuse! }
  }
  if (cardCode.startsWith('trump-')) {
    return { kind: 'trump', rank: cardCode.replace('trump-', ''), suit: 'trump', color: SUIT_COLORS.trump! }
  }
  const [suit, rank] = cardCode.split('-')
  return {
    kind: 'suit',
    rank: (rank ?? '?').toUpperCase(),
    suit: suit ?? '?',
    color: SUIT_COLORS[suit ?? ''] ?? '#334155',
  }
}

function drawBack(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#3f1d2e')
  g.addColorStop(0.5, '#6b2d4a')
  g.addColorStop(1, '#2a1520')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)'
  ctx.lineWidth = Math.max(4, w * 0.03)
  ctx.strokeRect(w * 0.06, h * 0.05, w * 0.88, h * 0.9)

  ctx.strokeStyle = 'rgba(254, 243, 199, 0.2)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 7; i++) {
    const y = h * (0.18 + i * 0.1)
    ctx.beginPath()
    ctx.moveTo(w * 0.14, y)
    ctx.lineTo(w * 0.86, y)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(254, 243, 199, 0.75)'
  ctx.font = `600 ${Math.floor(w * 0.12)}px "Iowan Old Style", "Palatino Linotype", Palatino, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('TAROT', w / 2, h / 2)
}

function drawFace(ctx: CanvasRenderingContext2D, w: number, h: number, cardCode: string) {
  const info = parseCard(cardCode)
  ctx.fillStyle = '#f4efe6'
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#efe6d8'
  ctx.fillRect(w * 0.08, h * 0.07, w * 0.84, h * 0.86)

  ctx.strokeStyle = info.color
  ctx.lineWidth = Math.max(3, w * 0.025)
  ctx.strokeRect(w * 0.05, h * 0.04, w * 0.9, h * 0.92)

  ctx.strokeStyle = 'rgba(120, 53, 15, 0.35)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(w * 0.09, h * 0.075, w * 0.82, h * 0.85)

  const corner = info.kind === 'suit'
    ? `${info.rank}\n${SUIT_MARK[info.suit] ?? ''}`
    : info.rank

  ctx.fillStyle = info.color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = `700 ${Math.floor(w * 0.16)}px "Iowan Old Style", "Palatino Linotype", Palatino, serif`
  ctx.fillText(info.rank, w * 0.12, h * 0.1)

  if (info.kind === 'suit') {
    ctx.font = `600 ${Math.floor(w * 0.12)}px sans-serif`
    ctx.fillText(SUIT_MARK[info.suit] ?? '', w * 0.12, h * 0.26)
  }

  ctx.save()
  ctx.translate(w * 0.88, h * 0.9)
  ctx.rotate(Math.PI)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = `700 ${Math.floor(w * 0.16)}px "Iowan Old Style", "Palatino Linotype", Palatino, serif`
  ctx.fillText(info.rank, 0, 0)
  if (info.kind === 'suit') {
    ctx.font = `600 ${Math.floor(w * 0.12)}px sans-serif`
    ctx.fillText(SUIT_MARK[info.suit] ?? '', 0, h * 0.16)
  }
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (info.kind === 'trump' || info.kind === 'excuse') {
    ctx.font = `700 ${Math.floor(w * 0.28)}px "Iowan Old Style", "Palatino Linotype", Palatino, serif`
    ctx.fillText(info.kind === 'excuse' ? 'Exc' : info.rank, w / 2, h * 0.48)
    ctx.font = `500 ${Math.floor(w * 0.08)}px sans-serif`
    ctx.fillStyle = 'rgba(120, 53, 15, 0.7)'
    ctx.fillText(info.kind === 'excuse' ? 'EXCUSE' : 'ATOUT', w / 2, h * 0.62)
  } else {
    ctx.font = `700 ${Math.floor(w * 0.42)}px Georgia, serif`
    ctx.fillStyle = info.color
    ctx.fillText(SUIT_MARK[info.suit] ?? '?', w / 2, h * 0.52)
  }

  void corner
}

/** Create a 3:4 canvas face/back for missing S3 textures (browser only). */
export function createPlaceholderImageBitmap(cardCode: CardId | string, size = 256): HTMLCanvasElement {
  const w = size
  const h = Math.round(size * (4 / 3))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  if (cardCode === 'back') {
    drawBack(ctx, w, h)
  } else {
    drawFace(ctx, w, h, cardCode)
  }
  return canvas
}
