import sharp from 'sharp'

type RenderCard = {
  label: string
  shortLabel: string
  rank?: string
  role?: string
  suit?: string
  aspectRatio: '3:4' | '9:16'
}

const pokerCard = { width: 900, height: 1200 }
const tarotCard = { width: 900, height: 1600 }

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getCardColor(card: RenderCard) {
  if (card.suit === 'hearts' || card.suit === 'diamonds') {
    return '#b91c1c'
  }

  if (card.suit === 'trumps') {
    return '#7c5c13'
  }

  return '#111827'
}

function getRankLabel(card: RenderCard) {
  const fromShortLabel = card.shortLabel.replace(/[^0-9A-Z]/gi, '')

  if (fromShortLabel) {
    return fromShortLabel.toUpperCase()
  }

  const rankMap: Record<string, string> = {
    J: 'V',
    Q: 'D',
    K: 'R'
  }

  return rankMap[card.rank || ''] || card.rank || card.shortLabel
}

function line(x1: number, y1: number, x2: number, y2: number, color: string, width = 7) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
}

function path(d: string, color: string, width = 7) {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
}

function drawSevenSegmentDigit(digit: string, x: number, y: number, width: number, height: number, color: string) {
  const segmentWidth = Math.max(5, Math.round(width * 0.13))
  const x1 = x + segmentWidth
  const x2 = x + width - segmentWidth
  const y1 = y + segmentWidth
  const y2 = y + height / 2
  const y3 = y + height - segmentWidth
  const segments: Record<string, string[]> = {
    0: ['a', 'b', 'c', 'd', 'e', 'f'],
    1: ['b', 'c'],
    2: ['a', 'b', 'g', 'e', 'd'],
    3: ['a', 'b', 'g', 'c', 'd'],
    4: ['f', 'g', 'b', 'c'],
    5: ['a', 'f', 'g', 'c', 'd'],
    6: ['a', 'f', 'g', 'e', 'c', 'd'],
    7: ['a', 'b', 'c'],
    8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    9: ['a', 'b', 'c', 'd', 'f', 'g']
  }
  const active = new Set(segments[digit] || [])
  const output = []

  if (active.has('a')) output.push(line(x1, y1, x2, y1, color, segmentWidth))
  if (active.has('b')) output.push(line(x2, y1, x2, y2, color, segmentWidth))
  if (active.has('c')) output.push(line(x2, y2, x2, y3, color, segmentWidth))
  if (active.has('d')) output.push(line(x1, y3, x2, y3, color, segmentWidth))
  if (active.has('e')) output.push(line(x1, y2, x1, y3, color, segmentWidth))
  if (active.has('f')) output.push(line(x1, y1, x1, y2, color, segmentWidth))
  if (active.has('g')) output.push(line(x1, y2, x2, y2, color, segmentWidth))

  return output.join('')
}

function drawLetter(letter: string, x: number, y: number, width: number, height: number, color: string) {
  const strokeWidth = Math.max(6, Math.round(width * 0.12))
  const left = x + strokeWidth
  const right = x + width - strokeWidth
  const top = y + strokeWidth
  const middle = y + height / 2
  const bottom = y + height - strokeWidth
  const center = x + width / 2

  switch (letter) {
    case 'A':
      return [
        line(left, bottom, center, top, color, strokeWidth),
        line(center, top, right, bottom, color, strokeWidth),
        line(left + width * 0.22, middle, right - width * 0.22, middle, color, strokeWidth)
      ].join('')
    case 'V':
      return [
        line(left, top, center, bottom, color, strokeWidth),
        line(center, bottom, right, top, color, strokeWidth)
      ].join('')
    case 'C':
      return path(`M ${right} ${top + height * 0.08} C ${left} ${top} ${left} ${bottom} ${right} ${bottom - height * 0.08}`, color, strokeWidth)
    case 'D':
      return [
        line(left, top, left, bottom, color, strokeWidth),
        path(`M ${left} ${top} C ${right} ${top} ${right} ${bottom} ${left} ${bottom}`, color, strokeWidth)
      ].join('')
    case 'R':
      return [
        line(left, top, left, bottom, color, strokeWidth),
        path(`M ${left} ${top} L ${right - width * 0.12} ${top} C ${right} ${top} ${right} ${middle} ${left} ${middle}`, color, strokeWidth),
        line(left + width * 0.32, middle, right, bottom, color, strokeWidth)
      ].join('')
    case 'K':
      return [
        line(left, top, left, bottom, color, strokeWidth),
        line(left + width * 0.1, middle, right, top, color, strokeWidth),
        line(left + width * 0.1, middle, right, bottom, color, strokeWidth)
      ].join('')
    case 'E':
      return [
        line(left, top, left, bottom, color, strokeWidth),
        line(left, top, right, top, color, strokeWidth),
        line(left, middle, right - width * 0.12, middle, color, strokeWidth),
        line(left, bottom, right, bottom, color, strokeWidth)
      ].join('')
    case 'X':
      return [
        line(left, top, right, bottom, color, strokeWidth),
        line(right, top, left, bottom, color, strokeWidth)
      ].join('')
    default:
      return ''
  }
}

function drawRank(label: string, x: number, y: number, width: number, height: number, color: string) {
  const chars = label.slice(0, 2).split('')
  const gap = chars.length > 1 ? width * 0.08 : 0
  const glyphWidth = chars.length > 1 ? (width - gap) / 2 : width

  return chars.map((char, index) => {
    const glyphX = x + index * (glyphWidth + gap)

    return /\d/.test(char)
      ? drawSevenSegmentDigit(char, glyphX, y, glyphWidth, height, color)
      : drawLetter(char.toUpperCase(), glyphX, y, glyphWidth, height, color)
  }).join('')
}

function drawSuit(card: RenderCard, cx: number, cy: number, size: number, color: string, opacity = 1) {
  const half = size / 2
  const quarter = size / 4
  const fill = `fill="${color}" opacity="${opacity}"`

  if (card.suit === 'hearts') {
    return `<path ${fill} d="M ${cx} ${cy + half * 0.72} C ${cx - half} ${cy + quarter} ${cx - half} ${cy - quarter} ${cx - quarter * 0.2} ${cy - quarter} C ${cx - quarter * 0.03} ${cy - quarter} ${cx - quarter * 0.03} ${cy - quarter * 0.03} ${cx} ${cy} C ${cx + quarter * 0.03} ${cy - quarter * 0.03} ${cx + quarter * 0.03} ${cy - quarter} ${cx + quarter * 0.2} ${cy - quarter} C ${cx + half} ${cy - quarter} ${cx + half} ${cy + quarter} ${cx} ${cy + half * 0.72} Z"/>`
  }

  if (card.suit === 'diamonds') {
    return `<polygon ${fill} points="${cx},${cy - half} ${cx + half * 0.72},${cy} ${cx},${cy + half} ${cx - half * 0.72},${cy}"/>`
  }

  if (card.suit === 'clubs') {
    return [
      `<circle ${fill} cx="${cx}" cy="${cy - quarter}" r="${quarter}"/>`,
      `<circle ${fill} cx="${cx - quarter}" cy="${cy + quarter * 0.1}" r="${quarter}"/>`,
      `<circle ${fill} cx="${cx + quarter}" cy="${cy + quarter * 0.1}" r="${quarter}"/>`,
      `<path ${fill} d="M ${cx - quarter * 0.35} ${cy + quarter * 0.2} L ${cx + quarter * 0.35} ${cy + quarter * 0.2} L ${cx + quarter * 0.55} ${cy + half} L ${cx - quarter * 0.55} ${cy + half} Z"/>`
    ].join('')
  }

  if (card.suit === 'spades') {
    return [
      `<path ${fill} d="M ${cx} ${cy - half * 0.72} C ${cx - half} ${cy - quarter} ${cx - half} ${cy + quarter} ${cx - quarter * 0.2} ${cy + quarter} C ${cx - quarter * 0.03} ${cy + quarter} ${cx - quarter * 0.03} ${cy + quarter * 0.03} ${cx} ${cy} C ${cx + quarter * 0.03} ${cy + quarter * 0.03} ${cx + quarter * 0.03} ${cy + quarter} ${cx + quarter * 0.2} ${cy + quarter} C ${cx + half} ${cy + quarter} ${cx + half} ${cy - quarter} ${cx} ${cy - half * 0.72} Z"/>`,
      `<path ${fill} d="M ${cx - quarter * 0.35} ${cy + quarter * 0.2} L ${cx + quarter * 0.35} ${cy + quarter * 0.2} L ${cx + quarter * 0.55} ${cy + half} L ${cx - quarter * 0.55} ${cy + half} Z"/>`
    ].join('')
  }

  if (card.suit === 'trumps') {
    return `<polygon ${fill} points="${cx},${cy - half} ${cx + quarter},${cy - quarter} ${cx + half},${cy} ${cx + quarter},${cy + quarter} ${cx},${cy + half} ${cx - quarter},${cy + quarter} ${cx - half},${cy} ${cx - quarter},${cy - quarter}"/>`
  }

  return `<circle ${fill} cx="${cx}" cy="${cy}" r="${quarter}"/>`
}

function drawIndex(card: RenderCard, x: number, y: number, rotate: boolean) {
  const color = getCardColor(card)
  const rankLabel = getRankLabel(card)
  const transform = rotate ? ` transform="rotate(180 ${x + 62} ${y + 92})"` : ''

  return `
    <g${transform}>
      <rect x="${x}" y="${y}" width="124" height="184" rx="26" fill="rgba(255,255,255,0.92)" stroke="rgba(17,24,39,0.22)" stroke-width="3"/>
      ${drawRank(rankLabel, x + 26, y + 22, 72, 70, color)}
      ${drawSuit(card, x + 62, y + 132, 62, color)}
    </g>
  `
}

function buildOverlay(card: RenderCard, width: number, height: number) {
  const safeLabel = escapeXml(card.label)
  const color = getCardColor(card)
  const indexInset = 38
  const indexWidth = 124
  const indexHeight = 184

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="42" fill="none" stroke="#111827" stroke-width="18"/>
      <rect x="50" y="50" width="${width - 100}" height="${height - 100}" rx="30" fill="none" stroke="#d4af37" stroke-width="7"/>
      <rect x="72" y="72" width="${width - 144}" height="${height - 144}" rx="22" fill="none" stroke="rgba(17,24,39,0.22)" stroke-width="3"/>
      ${drawSuit(card, width / 2, height - 116, 70, color, 0.9)}
      ${drawIndex(card, indexInset, indexInset, false)}
      ${drawIndex(card, width - indexInset - indexWidth, height - indexInset - indexHeight, true)}
      <rect x="${width * 0.28}" y="${height - 74}" width="${width * 0.44}" height="4" rx="2" fill="${color}" opacity="0.48" aria-label="${safeLabel}"/>
    </svg>
  `)
}

export async function renderCardImage(source: Buffer, card: RenderCard) {
  const dimensions = card.aspectRatio === '9:16' ? tarotCard : pokerCard

  const base = await sharp(source)
    .resize(dimensions.width, dimensions.height, { fit: 'cover' })
    .composite([{ input: buildOverlay(card, dimensions.width, dimensions.height), top: 0, left: 0 }])
    .png()
    .toBuffer()

  return base
}
