import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import opentype from 'opentype.js'
import sharp from 'sharp'

function resolveIndexFontPath() {
  const candidates = [
    join(process.cwd(), 'server/assets/fonts/LiberationSerif-Bold.ttf'),
    join(process.cwd(), 'public/fonts/LiberationSerif-Bold.ttf')
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(`Index font not found. Tried: ${candidates.join(', ')}`)
}

let indexFont: opentype.Font | null = null

function getIndexFont() {
  if (!indexFont) {
    const buffer = readFileSync(resolveIndexFontPath())
    indexFont = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
  }

  return indexFont
}

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
  // Equal optical inset from top and left edges.
  const indexInset = Math.round(dimensions.width * 0.036)
  const indexGap = Math.round(dimensions.width * 0.014)
  const indexWidth = Math.round(dimensions.width * (isTarot ? 0.078 : 0.072))
  const indexHeight = Math.round(dimensions.height * (isTarot ? 0.078 : 0.09))
  const marginX = indexInset + indexWidth + indexGap
  const marginY = indexInset + indexHeight + indexGap

  return {
    width: dimensions.width,
    height: dimensions.height,
    // Classic playing-card corners (~2.5–3% of width), not soft-toy round.
    cardRadius: Math.round(dimensions.width * 0.028),
    scene: {
      x: marginX,
      y: marginY,
      width: dimensions.width - marginX * 2,
      height: dimensions.height - marginY * 2,
      radius: Math.round(dimensions.width * 0.014)
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

/** Real serif face → SVG paths (Sharp cannot rasterize <text> reliably). */
function drawRank(label: string, x: number, y: number, width: number, height: number, color: string) {
  const text = label.slice(0, 2).toUpperCase()

  if (!text) {
    return ''
  }

  const font = getIndexFont()
  // Fit to the index box; slight side padding so glyphs don't kiss the edge.
  let fontSize = height * 0.92
  let advance = font.getAdvanceWidth(text, fontSize)

  if (advance > width * 0.98) {
    fontSize *= (width * 0.98) / advance
    advance = font.getAdvanceWidth(text, fontSize)
  }

  const baseline = y + height * 0.82
  const textX = x + (width - advance) / 2
  const path = font.getPath(text, textX, baseline, fontSize)

  return `<path d="${path.toPathData(1)}" fill="${color}"/>`
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

  // Rank sits in the top of the index column; suit sits clearly below with a gap.
  const rankWidth = indexWidth * (rankLabel.length > 1 ? 0.98 : 0.86)
  const rankHeight = isTrumpIndex
    ? Math.round(indexHeight * 0.72)
    : Math.round(indexHeight * 0.48)
  const rankX = centerX - rankWidth / 2
  const rankY = y + Math.round(indexWidth * 0.02)

  if (isTrumpIndex) {
    return `
      <g${transform}>
        ${drawRank(rankLabel, rankX, rankY, rankWidth, rankHeight, color)}
      </g>
    `
  }

  const suitSize = indexWidth * 0.62
  const suitGap = Math.round(indexWidth * 0.14)
  const suitCy = rankY + rankHeight + suitGap + suitSize * 0.45

  return `
    <g${transform}>
      ${drawRank(rankLabel, rankX, rankY, rankWidth, rankHeight, color)}
      ${drawSuit(card, centerX, suitCy, suitSize, color)}
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
