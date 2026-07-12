import sharp from 'sharp'

type RenderCard = {
  label: string
  shortLabel: string
  rank?: string
  role?: string
  suit?: string
  aspectRatio: '3:4' | '9:16'
}

type SceneFrame = {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

type CardLayout = {
  width: number
  height: number
  cardRadius: number
  scene: SceneFrame
  indexInset: number
  indexWidth: number
  indexHeight: number
  outerStroke: number
  frameGap: number
  frameOuter: number
  frameInner: number
}

const pokerCard = { width: 900, height: 1200 }
const tarotCard = { width: 900, height: 1600 }

/** Crop AI-painted edge frames before fitting the scene window. */
const SCENE_EDGE_CROP = 0.04

// Thresholds use 0-255 channel values. Tuned aggressively against antialiased green fringes.
const chromaGreenMinimum = 72
const chromaDominanceMinimum = 12
const chromaGreenRange = 100
const chromaDominanceRange = 70
const chromaPurityOffset = 24
const chromaPurityRange = 110
const chromaPurityWeight = 0.9
const greenSpillDominanceMinimum = 4
const greenSpillDominanceRange = 55
const greenSpillMinimum = 55
const greenSpillRange = 100
const neutralGreenTolerance = 4
const fringeAlphaCutoff = 0.18

/** Constrains chroma ratios used for alpha and spill cleanup to the [0, 1] range. */
function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

function getCardLayout(aspectRatio: RenderCard['aspectRatio']): CardLayout {
  const dimensions = aspectRatio === '9:16' ? tarotCard : pokerCard
  const isTarot = aspectRatio === '9:16'
  const indexInset = Math.round(dimensions.width * 0.028)
  const indexGap = Math.round(dimensions.width * 0.01)
  // Slightly wider indices on tarot so two-digit atouts (10–21) stay readable.
  const indexWidth = Math.round(dimensions.width * (isTarot ? 0.09 : 0.072))
  const indexHeight = Math.round(dimensions.height * (isTarot ? 0.086 : 0.092))
  const marginX = indexInset + indexWidth + indexGap
  const marginY = indexInset + indexHeight + indexGap

  return {
    width: dimensions.width,
    height: dimensions.height,
    cardRadius: Math.round(dimensions.width * 0.045),
    scene: {
      x: marginX,
      y: marginY,
      width: dimensions.width - marginX * 2,
      height: dimensions.height - marginY * 2,
      radius: Math.round(dimensions.width * 0.022)
    },
    indexInset,
    indexWidth,
    indexHeight,
    outerStroke: Math.max(2, Math.round(dimensions.width * 0.004)),
    frameGap: Math.max(3, Math.round(dimensions.width * 0.005)),
    frameOuter: Math.max(3, Math.round(dimensions.width * 0.0055)),
    frameInner: Math.max(2, Math.round(dimensions.width * 0.0035))
  }
}

function getCardColor(card: RenderCard) {
  if (card.suit === 'hearts' || card.suit === 'diamonds') {
    return '#b42318'
  }

  if (card.suit === 'trumps') {
    return '#8a6a1a'
  }

  return '#1c1917'
}

function getIndexStrokeColor(card: RenderCard) {
  if (card.suit === 'hearts' || card.suit === 'diamonds') {
    return 'rgba(180, 35, 24, 0.18)'
  }

  if (card.suit === 'trumps') {
    return 'rgba(138, 106, 26, 0.22)'
  }

  return 'rgba(28, 25, 23, 0.16)'
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

function filledPath(d: string, color: string) {
  return `<path d="${d}" fill="${color}" fill-rule="evenodd"/>`
}

/** Classic filled playing-card digit outlines (not seven-segment). */
function drawDigit(digit: string, x: number, y: number, width: number, height: number, color: string) {
  const paths: Record<string, string> = {
    0: `M ${x + width * 0.18} ${y + height * 0.12}
        C ${x + width * 0.18} ${y + height * 0.02} ${x + width * 0.82} ${y + height * 0.02} ${x + width * 0.82} ${y + height * 0.12}
        L ${x + width * 0.82} ${y + height * 0.88}
        C ${x + width * 0.82} ${y + height * 0.98} ${x + width * 0.18} ${y + height * 0.98} ${x + width * 0.18} ${y + height * 0.88}
        Z
        M ${x + width * 0.34} ${y + height * 0.22}
        L ${x + width * 0.34} ${y + height * 0.78}
        C ${x + width * 0.34} ${y + height * 0.84} ${x + width * 0.66} ${y + height * 0.84} ${x + width * 0.66} ${y + height * 0.78}
        L ${x + width * 0.66} ${y + height * 0.22}
        C ${x + width * 0.66} ${y + height * 0.16} ${x + width * 0.34} ${y + height * 0.16} ${x + width * 0.34} ${y + height * 0.22}
        Z`,
    1: `M ${x + width * 0.28} ${y + height * 0.22}
        L ${x + width * 0.52} ${y + height * 0.08}
        L ${x + width * 0.66} ${y + height * 0.08}
        L ${x + width * 0.66} ${y + height * 0.92}
        L ${x + width * 0.46} ${y + height * 0.92}
        L ${x + width * 0.46} ${y + height * 0.28}
        L ${x + width * 0.28} ${y + height * 0.38}
        Z`,
    2: `M ${x + width * 0.16} ${y + height * 0.2}
        C ${x + width * 0.16} ${y + height * 0.04} ${x + width * 0.84} ${y + height * 0.04} ${x + width * 0.84} ${y + height * 0.22}
        C ${x + width * 0.84} ${y + height * 0.4} ${x + width * 0.42} ${y + height * 0.5} ${x + width * 0.28} ${y + height * 0.62}
        L ${x + width * 0.28} ${y + height * 0.78}
        L ${x + width * 0.84} ${y + height * 0.78}
        L ${x + width * 0.84} ${y + height * 0.92}
        L ${x + width * 0.14} ${y + height * 0.92}
        L ${x + width * 0.14} ${y + height * 0.68}
        C ${x + width * 0.14} ${y + height * 0.56} ${x + width * 0.62} ${y + height * 0.48} ${x + width * 0.62} ${y + height * 0.26}
        C ${x + width * 0.62} ${y + height * 0.18} ${x + width * 0.36} ${y + height * 0.18} ${x + width * 0.36} ${y + height * 0.28}
        Z`,
    3: `M ${x + width * 0.18} ${y + height * 0.08}
        L ${x + width * 0.78} ${y + height * 0.08}
        C ${x + width * 0.96} ${y + height * 0.08} ${x + width * 0.96} ${y + height * 0.4} ${x + width * 0.72} ${y + height * 0.48}
        C ${x + width * 0.96} ${y + height * 0.54} ${x + width * 0.96} ${y + height * 0.92} ${x + width * 0.72} ${y + height * 0.92}
        L ${x + width * 0.18} ${y + height * 0.92}
        L ${x + width * 0.18} ${y + height * 0.76}
        L ${x + width * 0.66} ${y + height * 0.76}
        C ${x + width * 0.78} ${y + height * 0.76} ${x + width * 0.78} ${y + height * 0.6} ${x + width * 0.62} ${y + height * 0.56}
        L ${x + width * 0.34} ${y + height * 0.56}
        L ${x + width * 0.34} ${y + height * 0.42}
        L ${x + width * 0.62} ${y + height * 0.42}
        C ${x + width * 0.76} ${y + height * 0.42} ${x + width * 0.76} ${y + height * 0.24} ${x + width * 0.62} ${y + height * 0.24}
        L ${x + width * 0.18} ${y + height * 0.24}
        Z`,
    4: `M ${x + width * 0.62} ${y + height * 0.08}
        L ${x + width * 0.62} ${y + height * 0.52}
        L ${x + width * 0.84} ${y + height * 0.52}
        L ${x + width * 0.84} ${y + height * 0.66}
        L ${x + width * 0.62} ${y + height * 0.66}
        L ${x + width * 0.62} ${y + height * 0.92}
        L ${x + width * 0.42} ${y + height * 0.92}
        L ${x + width * 0.42} ${y + height * 0.66}
        L ${x + width * 0.14} ${y + height * 0.66}
        L ${x + width * 0.14} ${y + height * 0.5}
        L ${x + width * 0.42} ${y + height * 0.08}
        Z
        M ${x + width * 0.42} ${y + height * 0.28}
        L ${x + width * 0.42} ${y + height * 0.52}
        L ${x + width * 0.3} ${y + height * 0.52}
        Z`,
    5: `M ${x + width * 0.22} ${y + height * 0.08}
        L ${x + width * 0.82} ${y + height * 0.08}
        L ${x + width * 0.82} ${y + height * 0.24}
        L ${x + width * 0.4} ${y + height * 0.24}
        L ${x + width * 0.4} ${y + height * 0.4}
        L ${x + width * 0.66} ${y + height * 0.4}
        C ${x + width * 0.96} ${y + height * 0.4} ${x + width * 0.96} ${y + height * 0.92} ${x + width * 0.64} ${y + height * 0.92}
        L ${x + width * 0.2} ${y + height * 0.92}
        L ${x + width * 0.2} ${y + height * 0.76}
        L ${x + width * 0.62} ${y + height * 0.76}
        C ${x + width * 0.76} ${y + height * 0.76} ${x + width * 0.76} ${y + height * 0.56} ${x + width * 0.62} ${y + height * 0.56}
        L ${x + width * 0.22} ${y + height * 0.56}
        Z`,
    6: `M ${x + width * 0.72} ${y + height * 0.08}
        L ${x + width * 0.42} ${y + height * 0.08}
        C ${x + width * 0.12} ${y + height * 0.08} ${x + width * 0.12} ${y + height * 0.92} ${x + width * 0.42} ${y + height * 0.92}
        L ${x + width * 0.64} ${y + height * 0.92}
        C ${x + width * 0.94} ${y + height * 0.92} ${x + width * 0.94} ${y + height * 0.44} ${x + width * 0.64} ${y + height * 0.44}
        L ${x + width * 0.42} ${y + height * 0.44}
        C ${x + width * 0.3} ${y + height * 0.44} ${x + width * 0.3} ${y + height * 0.24} ${x + width * 0.42} ${y + height * 0.24}
        L ${x + width * 0.72} ${y + height * 0.24}
        Z
        M ${x + width * 0.42} ${y + height * 0.58}
        L ${x + width * 0.62} ${y + height * 0.58}
        C ${x + width * 0.74} ${y + height * 0.58} ${x + width * 0.74} ${y + height * 0.78} ${x + width * 0.62} ${y + height * 0.78}
        L ${x + width * 0.42} ${y + height * 0.78}
        C ${x + width * 0.3} ${y + height * 0.78} ${x + width * 0.3} ${y + height * 0.58} ${x + width * 0.42} ${y + height * 0.58}
        Z`,
    7: `M ${x + width * 0.16} ${y + height * 0.08}
        L ${x + width * 0.86} ${y + height * 0.08}
        L ${x + width * 0.86} ${y + height * 0.24}
        L ${x + width * 0.48} ${y + height * 0.92}
        L ${x + width * 0.26} ${y + height * 0.92}
        L ${x + width * 0.62} ${y + height * 0.28}
        L ${x + width * 0.16} ${y + height * 0.28}
        Z`,
    8: `M ${x + width * 0.5} ${y + height * 0.04}
        C ${x + width * 0.82} ${y + height * 0.04} ${x + width * 0.9} ${y + height * 0.3} ${x + width * 0.72} ${y + height * 0.42}
        C ${x + width * 0.92} ${y + height * 0.5} ${x + width * 0.92} ${y + height * 0.96} ${x + width * 0.5} ${y + height * 0.96}
        C ${x + width * 0.08} ${y + height * 0.96} ${x + width * 0.08} ${y + height * 0.5} ${x + width * 0.28} ${y + height * 0.42}
        C ${x + width * 0.1} ${y + height * 0.3} ${x + width * 0.18} ${y + height * 0.04} ${x + width * 0.5} ${y + height * 0.04}
        Z
        M ${x + width * 0.5} ${y + height * 0.18}
        C ${x + width * 0.34} ${y + height * 0.18} ${x + width * 0.34} ${y + height * 0.36} ${x + width * 0.5} ${y + height * 0.36}
        C ${x + width * 0.66} ${y + height * 0.36} ${x + width * 0.66} ${y + height * 0.18} ${x + width * 0.5} ${y + height * 0.18}
        Z
        M ${x + width * 0.5} ${y + height * 0.5}
        C ${x + width * 0.32} ${y + height * 0.5} ${x + width * 0.32} ${y + height * 0.82} ${x + width * 0.5} ${y + height * 0.82}
        C ${x + width * 0.68} ${y + height * 0.82} ${x + width * 0.68} ${y + height * 0.5} ${x + width * 0.5} ${y + height * 0.5}
        Z`,
    9: `M ${x + width * 0.28} ${y + height * 0.92}
        L ${x + width * 0.58} ${y + height * 0.92}
        C ${x + width * 0.88} ${y + height * 0.92} ${x + width * 0.88} ${y + height * 0.08} ${x + width * 0.58} ${y + height * 0.08}
        L ${x + width * 0.36} ${y + height * 0.08}
        C ${x + width * 0.06} ${y + height * 0.08} ${x + width * 0.06} ${y + height * 0.56} ${x + width * 0.36} ${y + height * 0.56}
        L ${x + width * 0.58} ${y + height * 0.56}
        C ${x + width * 0.7} ${y + height * 0.56} ${x + width * 0.7} ${y + height * 0.76} ${x + width * 0.58} ${y + height * 0.76}
        L ${x + width * 0.28} ${y + height * 0.76}
        Z
        M ${x + width * 0.38} ${y + height * 0.22}
        L ${x + width * 0.56} ${y + height * 0.22}
        C ${x + width * 0.68} ${y + height * 0.22} ${x + width * 0.68} ${y + height * 0.42} ${x + width * 0.56} ${y + height * 0.42}
        L ${x + width * 0.38} ${y + height * 0.42}
        C ${x + width * 0.26} ${y + height * 0.42} ${x + width * 0.26} ${y + height * 0.22} ${x + width * 0.38} ${y + height * 0.22}
        Z`
  }

  return paths[digit] ? filledPath(paths[digit], color) : ''
}

function drawLetter(letter: string, x: number, y: number, width: number, height: number, color: string) {
  const paths: Record<string, string> = {
    A: `M ${x + width * 0.08} ${y + height * 0.92}
        L ${x + width * 0.38} ${y + height * 0.08}
        L ${x + width * 0.62} ${y + height * 0.08}
        L ${x + width * 0.92} ${y + height * 0.92}
        L ${x + width * 0.7} ${y + height * 0.92}
        L ${x + width * 0.64} ${y + height * 0.72}
        L ${x + width * 0.36} ${y + height * 0.72}
        L ${x + width * 0.3} ${y + height * 0.92}
        Z
        M ${x + width * 0.4} ${y + height * 0.56}
        L ${x + width * 0.6} ${y + height * 0.56}
        L ${x + width * 0.5} ${y + height * 0.26}
        Z`,
    V: `M ${x + width * 0.08} ${y + height * 0.08}
        L ${x + width * 0.3} ${y + height * 0.08}
        L ${x + width * 0.5} ${y + height * 0.72}
        L ${x + width * 0.7} ${y + height * 0.08}
        L ${x + width * 0.92} ${y + height * 0.08}
        L ${x + width * 0.62} ${y + height * 0.92}
        L ${x + width * 0.38} ${y + height * 0.92}
        Z`,
    C: `M ${x + width * 0.86} ${y + height * 0.22}
        C ${x + width * 0.78} ${y + height * 0.06} ${x + width * 0.14} ${y + height * 0.02} ${x + width * 0.14} ${y + height * 0.5}
        C ${x + width * 0.14} ${y + height * 0.98} ${x + width * 0.78} ${y + height * 0.94} ${x + width * 0.86} ${y + height * 0.78}
        L ${x + width * 0.64} ${y + height * 0.68}
        C ${x + width * 0.58} ${y + height * 0.78} ${x + width * 0.34} ${y + height * 0.78} ${x + width * 0.34} ${y + height * 0.5}
        C ${x + width * 0.34} ${y + height * 0.22} ${x + width * 0.58} ${y + height * 0.22} ${x + width * 0.64} ${y + height * 0.32}
        Z`,
    D: `M ${x + width * 0.14} ${y + height * 0.08}
        L ${x + width * 0.48} ${y + height * 0.08}
        C ${x + width * 0.92} ${y + height * 0.08} ${x + width * 0.92} ${y + height * 0.92} ${x + width * 0.48} ${y + height * 0.92}
        L ${x + width * 0.14} ${y + height * 0.92}
        Z
        M ${x + width * 0.32} ${y + height * 0.24}
        L ${x + width * 0.32} ${y + height * 0.76}
        L ${x + width * 0.46} ${y + height * 0.76}
        C ${x + width * 0.7} ${y + height * 0.76} ${x + width * 0.7} ${y + height * 0.24} ${x + width * 0.46} ${y + height * 0.24}
        Z`,
    R: `M ${x + width * 0.14} ${y + height * 0.08}
        L ${x + width * 0.58} ${y + height * 0.08}
        C ${x + width * 0.9} ${y + height * 0.08} ${x + width * 0.9} ${y + height * 0.48} ${x + width * 0.58} ${y + height * 0.52}
        L ${x + width * 0.86} ${y + height * 0.92}
        L ${x + width * 0.62} ${y + height * 0.92}
        L ${x + width * 0.38} ${y + height * 0.56}
        L ${x + width * 0.32} ${y + height * 0.56}
        L ${x + width * 0.32} ${y + height * 0.92}
        L ${x + width * 0.14} ${y + height * 0.92}
        Z
        M ${x + width * 0.32} ${y + height * 0.24}
        L ${x + width * 0.32} ${y + height * 0.42}
        L ${x + width * 0.54} ${y + height * 0.42}
        C ${x + width * 0.68} ${y + height * 0.42} ${x + width * 0.68} ${y + height * 0.24} ${x + width * 0.54} ${y + height * 0.24}
        Z`,
    K: `M ${x + width * 0.14} ${y + height * 0.08}
        L ${x + width * 0.34} ${y + height * 0.08}
        L ${x + width * 0.34} ${y + height * 0.42}
        L ${x + width * 0.58} ${y + height * 0.08}
        L ${x + width * 0.84} ${y + height * 0.08}
        L ${x + width * 0.5} ${y + height * 0.48}
        L ${x + width * 0.86} ${y + height * 0.92}
        L ${x + width * 0.6} ${y + height * 0.92}
        L ${x + width * 0.34} ${y + height * 0.58}
        L ${x + width * 0.34} ${y + height * 0.92}
        L ${x + width * 0.14} ${y + height * 0.92}
        Z`,
    E: `M ${x + width * 0.16} ${y + height * 0.08}
        L ${x + width * 0.84} ${y + height * 0.08}
        L ${x + width * 0.84} ${y + height * 0.24}
        L ${x + width * 0.36} ${y + height * 0.24}
        L ${x + width * 0.36} ${y + height * 0.4}
        L ${x + width * 0.74} ${y + height * 0.4}
        L ${x + width * 0.74} ${y + height * 0.56}
        L ${x + width * 0.36} ${y + height * 0.56}
        L ${x + width * 0.36} ${y + height * 0.76}
        L ${x + width * 0.84} ${y + height * 0.76}
        L ${x + width * 0.84} ${y + height * 0.92}
        L ${x + width * 0.16} ${y + height * 0.92}
        Z`,
    X: `M ${x + width * 0.12} ${y + height * 0.08}
        L ${x + width * 0.34} ${y + height * 0.08}
        L ${x + width * 0.5} ${y + height * 0.36}
        L ${x + width * 0.66} ${y + height * 0.08}
        L ${x + width * 0.88} ${y + height * 0.08}
        L ${x + width * 0.62} ${y + height * 0.5}
        L ${x + width * 0.88} ${y + height * 0.92}
        L ${x + width * 0.66} ${y + height * 0.92}
        L ${x + width * 0.5} ${y + height * 0.64}
        L ${x + width * 0.34} ${y + height * 0.92}
        L ${x + width * 0.12} ${y + height * 0.92}
        L ${x + width * 0.38} ${y + height * 0.5}
        Z`
  }

  return paths[letter] ? filledPath(paths[letter], color) : ''
}

function drawRank(label: string, x: number, y: number, width: number, height: number, color: string) {
  const chars = label.slice(0, 2).split('')
  const gap = chars.length > 1 ? width * 0.06 : 0
  const glyphWidth = chars.length > 1 ? (width - gap) / 2 : width

  return chars.map((char, index) => {
    const glyphX = x + index * (glyphWidth + gap)

    return /\d/.test(char)
      ? drawDigit(char, glyphX, y, glyphWidth, height, color)
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

  // Trumps / Excuse: no suit pip (avoids looking like diamonds).
  return ''
}

function drawIndex(card: RenderCard, layout: CardLayout, x: number, y: number, rotate: boolean) {
  const color = getCardColor(card)
  const rankLabel = getRankLabel(card)
  const { indexWidth, indexHeight } = layout
  const isTrumpIndex = card.suit === 'trumps'
  const centerX = x + indexWidth / 2
  const transform = rotate
    ? ` transform="rotate(180 ${centerX} ${y + indexHeight / 2})"`
    : ''

  // Use path glyphs (not SVG <text>) so Sharp/librsvg always renders indices.
  if (isTrumpIndex) {
    const rankHeight = indexHeight * (rankLabel.length > 1 ? 0.55 : 0.62)
    const rankWidth = indexWidth * (rankLabel.length > 1 ? 1.05 : 0.85)
    const rankX = centerX - rankWidth / 2

    return `
      <g${transform}>
        ${drawRank(rankLabel, rankX, y + indexHeight * 0.18, rankWidth, rankHeight, color)}
      </g>
    `
  }

  const rankHeight = indexHeight * 0.48
  const suitSize = indexWidth * 0.72
  const rankWidth = indexWidth * 0.9

  return `
    <g${transform}>
      ${drawRank(rankLabel, x + indexWidth * 0.05, y, rankWidth, rankHeight, color)}
      ${drawSuit(card, centerX, y + indexHeight * 0.72, suitSize, color)}
    </g>
  `
}

function buildSceneFrameOverlay(card: RenderCard, layout: CardLayout) {
  const {
    width,
    height,
    scene,
    frameGap,
    frameOuter,
    frameInner
  } = layout
  const color = getCardColor(card)
  const accentStroke = getIndexStrokeColor(card)
  const frameX = scene.x
  const frameY = scene.y
  const frameW = scene.width
  const frameH = scene.height
  const outerRx = Math.max(2, scene.radius)
  const innerRx = Math.max(2, scene.radius - frameGap - frameOuter)

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="sceneShadow" x="-10%" y="-8%" width="120%" height="120%">
          <feDropShadow dx="0" dy="5" stdDeviation="10" flood-color="${color}" flood-opacity="0.12"/>
        </filter>
      </defs>

      <rect
        x="${frameX + 1}"
        y="${frameY + 2}"
        width="${frameW - 2}"
        height="${frameH - 2}"
        rx="${outerRx}"
        fill="${color}"
        opacity="0.04"
        filter="url(#sceneShadow)"
      />

      <rect
        x="${frameX}"
        y="${frameY}"
        width="${frameW}"
        height="${frameH}"
        rx="${outerRx}"
        fill="none"
        stroke="${color}"
        stroke-opacity="0.62"
        stroke-width="${frameOuter}"
      />

      <rect
        x="${frameX + frameGap + frameOuter}"
        y="${frameY + frameGap + frameOuter}"
        width="${frameW - (frameGap + frameOuter) * 2}"
        height="${frameH - (frameGap + frameOuter) * 2}"
        rx="${innerRx}"
        fill="none"
        stroke="${accentStroke}"
        stroke-width="${frameInner}"
      />
    </svg>
  `)
}

function buildChromeOverlay(card: RenderCard, layout: CardLayout) {
  const {
    width,
    height,
    cardRadius,
    indexInset,
    indexWidth,
    indexHeight,
    outerStroke
  } = layout
  const color = getCardColor(card)
  const outerInset = Math.round(width * 0.012)

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="paperGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0.9  0 0 0 0 0.88  0 0 0 0 0.84  0 0 0 0.04 0"/>
        </filter>
      </defs>

      <rect
        x="${outerInset}"
        y="${outerInset}"
        width="${width - outerInset * 2}"
        height="${height - outerInset * 2}"
        rx="${Math.max(2, cardRadius - outerInset)}"
        fill="none"
        stroke="${color}"
        stroke-opacity="0.22"
        stroke-width="${outerStroke}"
      />

      <rect width="${width}" height="${height}" filter="url(#paperGrain)" opacity="1"/>

      ${drawIndex(card, layout, indexInset, indexInset, false)}
      ${drawIndex(card, layout, width - indexInset - indexWidth, height - indexInset - indexHeight, true)}
    </svg>
  `)
}

async function cropSceneSource(source: Buffer) {
  const image = sharp(source)
  const metadata = await image.metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0

  if (!width || !height) {
    return source
  }

  const cropX = Math.round(width * SCENE_EDGE_CROP)
  const cropY = Math.round(height * SCENE_EDGE_CROP)
  const cropWidth = Math.max(1, width - cropX * 2)
  const cropHeight = Math.max(1, height - cropY * 2)

  return image
    .extract({
      left: cropX,
      top: cropY,
      width: cropWidth,
      height: cropHeight
    })
    .png()
    .toBuffer()
}

async function buildSceneImage(source: Buffer, width: number, height: number, radius: number) {
  const cropped = await cropSceneSource(source)
  const mask = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" fill="#ffffff"/>
    </svg>
  `)

  return sharp(cropped)
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

  const width = info.width
  const height = info.height
  const alpha = new Float32Array(width * height)

  for (let index = 0; index < data.length; index += 4) {
    const pixel = index / 4
    const red = data[index] || 0
    const green = data[index + 1] || 0
    const blue = data[index + 2] || 0
    const sourceAlpha = (data[index + 3] || 0) / 255
    const strongestNonGreen = Math.max(red, blue)
    const weakestNonGreen = Math.min(red, blue)
    const greenDominance = green - strongestNonGreen
    let nextAlpha = sourceAlpha

    // Near-pure screen green → fully transparent.
    if (green >= 200 && red <= 90 && blue <= 90) {
      nextAlpha = 0
    } else if (green > chromaGreenMinimum && greenDominance > chromaDominanceMinimum) {
      const greenStrength = clamp((green - chromaGreenMinimum) / chromaGreenRange)
      const dominanceStrength = clamp((greenDominance - chromaDominanceMinimum) / chromaDominanceRange)
      const purityStrength = clamp((green - weakestNonGreen - chromaPurityOffset) / chromaPurityRange)
      const removal = Math.max(
        greenStrength * dominanceStrength,
        dominanceStrength * purityStrength * chromaPurityWeight
      )

      nextAlpha = sourceAlpha * (1 - removal)
    }

    if (greenDominance > greenSpillDominanceMinimum) {
      const spillDominanceRatio = clamp((greenDominance - greenSpillDominanceMinimum) / greenSpillDominanceRange)
      const spillGreenRatio = clamp((green - greenSpillMinimum) / greenSpillRange)
      const spillReduction = Math.min(1, spillDominanceRatio * spillGreenRatio * 1.35)
      const neutralGreen = Math.min(green, strongestNonGreen + neutralGreenTolerance)

      data[index + 1] = Math.round(green + (neutralGreen - green) * spillReduction)

      // Pull red/blue up slightly on spill edges so leftover fringe is less neon.
      if (spillReduction > 0.25) {
        data[index] = Math.min(255, Math.round(red + spillReduction * 12))
        data[index + 2] = Math.min(255, Math.round(blue + spillReduction * 8))
      }
    }

    // Drop nearly-transparent fringe pixels that still look green.
    if (nextAlpha < fringeAlphaCutoff && greenDominance > 10) {
      nextAlpha = 0
    }

    alpha[pixel] = nextAlpha
  }

  // Net-shrink silhouette: two erodes, one dilate — removes green halo while keeping shape.
  const erodedOnce = morphologyMin(alpha, width, height)
  const erodedTwice = morphologyMin(erodedOnce, width, height)
  const cleaned = morphologyMax(erodedTwice, width, height)

  for (let index = 0; index < data.length; index += 4) {
    const pixel = index / 4
    const nextAlpha = cleaned[pixel] || 0
    data[index + 3] = Math.round(nextAlpha * 255)

    // Final despill on remaining edge pixels.
    if (nextAlpha > 0 && nextAlpha < 0.92) {
      const red = data[index] || 0
      const green = data[index + 1] || 0
      const blue = data[index + 2] || 0
      const maxRB = Math.max(red, blue)

      if (green > maxRB + 4) {
        data[index + 1] = Math.round(maxRB + 2)
      }
    }
  }

  return sharp(data, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer()
}

function morphologyMin(source: Float32Array, width: number, height: number) {
  const output = new Float32Array(source.length)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let minAlpha = 1

      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = Math.min(width - 1, Math.max(0, x + ox))
          const ny = Math.min(height - 1, Math.max(0, y + oy))
          minAlpha = Math.min(minAlpha, source[ny * width + nx] || 0)
        }
      }

      output[y * width + x] = minAlpha
    }
  }

  return output
}

function morphologyMax(source: Float32Array, width: number, height: number) {
  const output = new Float32Array(source.length)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let maxAlpha = 0

      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = Math.min(width - 1, Math.max(0, x + ox))
          const ny = Math.min(height - 1, Math.max(0, y + oy))
          maxAlpha = Math.max(maxAlpha, source[ny * width + nx] || 0)
        }
      }

      output[y * width + x] = maxAlpha
    }
  }

  return output
}

/**
 * Build a transparent character layer sized to the full card.
 * Slightly inset so the figure can overlap the scene frame without covering indices.
 */
async function buildForegroundImage(source: Buffer, width: number, height: number) {
  const cutout = await removeChromaGreen(source)
  const targetHeight = Math.round(height * 0.92)
  const targetWidth = Math.round(width * 0.88)
  const resized = await sharp(cutout)
    .resize(targetWidth, targetHeight, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer()

  const left = Math.round((width - targetWidth) / 2)
  const top = Math.round(height * 0.06)

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer()
}

async function applyCardCornerMask(image: Buffer, width: number, height: number, radius: number) {
  const mask = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" fill="#ffffff"/>
    </svg>
  `)

  return sharp(image)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

/**
 * Assemble card from two distinct AI images:
 * 1) scene/background (clipped into the vignette)
 * 2) character cutout (transparent, drawn above the frame)
 * then overlay indices and outer chrome.
 */
export async function renderCardImage(source: Buffer, card: RenderCard, foreground?: Buffer) {
  const layout = getCardLayout(card.aspectRatio)
  const { width, height, cardRadius, scene } = layout
  const sceneImage = await buildSceneImage(source, scene.width, scene.height, scene.radius)
  const foregroundImage = foreground
    ? await buildForegroundImage(foreground, width, height)
    : null
  const layers = [
    { input: sceneImage, top: scene.y, left: scene.x },
    { input: buildSceneFrameOverlay(card, layout), top: 0, left: 0 }
  ]

  if (foregroundImage) {
    layers.push({ input: foregroundImage, top: 0, left: 0 })
  }

  layers.push({ input: buildChromeOverlay(card, layout), top: 0, left: 0 })

  const flat = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 250, g: 248, b: 244, alpha: 1 }
    }
  })
    .composite(layers)
    .png()
    .toBuffer()

  return applyCardCornerMask(flat, width, height, cardRadius)
}
