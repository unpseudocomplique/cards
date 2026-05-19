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

// Thresholds use 0-255 channel values tuned to remove antialiased chroma edges while preserving muted natural greens.
const chromaGreenMinimum = 96
const chromaDominanceMinimum = 18
const chromaGreenRange = 112
const chromaDominanceRange = 86
const chromaPurityOffset = 32
const chromaPurityRange = 128
const chromaPurityWeight = 0.8
const greenSpillDominanceMinimum = 8
const greenSpillDominanceRange = 70
const greenSpillMinimum = 80
const greenSpillRange = 120
const neutralGreenTolerance = 6

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

function getSceneFrame(width: number, height: number) {
  return {
    x: Math.round(width * 0.16),
    y: Math.round(height * 0.1),
    width: Math.round(width * 0.68),
    height: Math.round(height * 0.78),
    radius: 18
  }
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
    const scale = size / 100

    return `<path ${fill} transform="translate(${cx} ${cy + size * 0.06}) scale(${scale})" d="M 0 40 C -6 31 -43 8 -43 -21 C -43 -45 -17 -55 0 -32 C 17 -55 43 -45 43 -21 C 43 8 6 31 0 40 Z"/>`
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
      `<path ${fill} d="M ${cx} ${cy - half * 0.9} C ${cx - half * 0.45} ${cy - half * 0.45} ${cx - half * 0.9} ${cy - half * 0.18} ${cx - half * 0.86} ${cy + quarter * 0.38} C ${cx - half * 0.82} ${cy + quarter * 0.96} ${cx - quarter * 0.14} ${cy + quarter * 1.08} ${cx} ${cy + quarter * 0.2} C ${cx + quarter * 0.14} ${cy + quarter * 1.08} ${cx + half * 0.82} ${cy + quarter * 0.96} ${cx + half * 0.86} ${cy + quarter * 0.38} C ${cx + half * 0.9} ${cy - half * 0.18} ${cx + half * 0.45} ${cy - half * 0.45} ${cx} ${cy - half * 0.9} Z"/>`,
      `<path ${fill} d="M ${cx - quarter * 0.22} ${cy + quarter * 0.12} C ${cx - quarter * 0.12} ${cy + quarter * 0.6} ${cx - quarter * 0.35} ${cy + half * 0.76} ${cx - quarter * 0.62} ${cy + half * 0.84} L ${cx + quarter * 0.62} ${cy + half * 0.84} C ${cx + quarter * 0.35} ${cy + half * 0.76} ${cx + quarter * 0.12} ${cy + quarter * 0.6} ${cx + quarter * 0.22} ${cy + quarter * 0.12} Z"/>`
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
  const indexInset = 36
  const indexWidth = 124
  const indexHeight = 184

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${drawIndex(card, indexInset, indexInset, false)}
      ${drawIndex(card, width - indexInset - indexWidth, height - indexInset - indexHeight, true)}
    </svg>
  `)
}

async function buildSceneImage(source: Buffer, width: number, height: number, radius: number) {
  const mask = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" fill="#ffffff"/>
    </svg>
  `)

  return sharp(source)
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function removeChromaGreen(source: Buffer) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] || 0
    const green = data[index + 1] || 0
    const blue = data[index + 2] || 0
    const alpha = data[index + 3] || 0
    const strongestNonGreen = Math.max(red, blue)
    const weakestNonGreen = Math.min(red, blue)
    const greenDominance = green - strongestNonGreen

    if (green > chromaGreenMinimum && greenDominance > chromaDominanceMinimum) {
      const greenStrength = clamp((green - chromaGreenMinimum) / chromaGreenRange)
      const dominanceStrength = clamp((greenDominance - chromaDominanceMinimum) / chromaDominanceRange)
      const purityStrength = clamp((green - weakestNonGreen - chromaPurityOffset) / chromaPurityRange)
      const removal = Math.max(
        greenStrength * dominanceStrength,
        dominanceStrength * purityStrength * chromaPurityWeight
      )

      data[index + 3] = Math.round(alpha * (1 - removal))
    }

    if (greenDominance > greenSpillDominanceMinimum) {
      const spillDominanceRatio = clamp((greenDominance - greenSpillDominanceMinimum) / greenSpillDominanceRange)
      const spillGreenRatio = clamp((green - greenSpillMinimum) / greenSpillRange)
      const spillReduction = spillDominanceRatio * spillGreenRatio
      const neutralGreen = Math.min(green, strongestNonGreen + neutralGreenTolerance)

      data[index + 1] = Math.round(green + (neutralGreen - green) * spillReduction)
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
    .png()
    .toBuffer()
}

async function buildForegroundImage(source: Buffer, width: number, height: number) {
  const cutout = await removeChromaGreen(source)

  return sharp(cutout)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer()
}

export async function renderCardImage(source: Buffer, card: RenderCard, foreground?: Buffer) {
  const dimensions = card.aspectRatio === '9:16' ? tarotCard : pokerCard
  const scene = getSceneFrame(dimensions.width, dimensions.height)
  const sceneImage = await buildSceneImage(source, scene.width, scene.height, scene.radius)
  const foregroundImage = foreground
    ? await buildForegroundImage(foreground, dimensions.width, dimensions.height)
    : null
  const layers = [
    { input: sceneImage, top: scene.y, left: scene.x }
  ]

  if (foregroundImage) {
    layers.push({ input: foregroundImage, top: 0, left: 0 })
  }

  layers.push({ input: buildOverlay(card, dimensions.width, dimensions.height), top: 0, left: 0 })

  const base = await sharp({
    create: {
      width: dimensions.width,
      height: dimensions.height,
      channels: 4,
      background: '#ffffff'
    }
  })
    .composite(layers)
    .png()
    .toBuffer()

  return base
}
