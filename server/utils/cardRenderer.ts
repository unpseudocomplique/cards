import sharp from 'sharp'
import { ensureIndexFont, getIndexFont } from '~~/server/utils/indexFont'
import type { RenderProfile } from '~~/shared/utils/printSpec'
import { getCanvasPx } from '~~/shared/utils/printSpec'

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
  bleed: number
  contentX: number
  contentY: number
  contentWidth: number
  contentHeight: number
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

/** Crop AI-painted edge frames before fitting the scene window. */
const SCENE_EDGE_CROP = 0.04

/** Metallic gold for on-screen dorure (preview). Foil mask is separate for press. */
const FOIL_GOLD = {
  mid: '#c5a035',
  light: '#f0d78c',
  dark: '#8a6a1a'
} as const

const FOIL_MASK_BLACK = '#000000'

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

function getCardLayout(
  aspectRatio: RenderCard['aspectRatio'],
  profile: RenderProfile = 'screen'
): CardLayout {
  const canvas = getCanvasPx(aspectRatio, profile)
  const bleed = canvas.bleed
  const contentWidth = canvas.width - bleed * 2
  const contentHeight = canvas.height - bleed * 2
  const isTarot = aspectRatio === '9:16'
  // Layout proportions are relative to the trim/content box (not including bleed).
  const indexInset = Math.round(contentWidth * 0.036)
  const indexGap = Math.round(contentWidth * 0.014)
  const indexWidth = Math.round(contentWidth * (isTarot ? 0.078 : 0.072))
  const indexHeight = Math.round(contentHeight * (isTarot ? 0.078 : 0.09))
  const marginX = indexInset + indexWidth + indexGap
  const marginY = indexInset + indexHeight + indexGap

  return {
    width: canvas.width,
    height: canvas.height,
    bleed,
    contentX: bleed,
    contentY: bleed,
    contentWidth,
    contentHeight,
    // Classic playing-card corners (~2.5–3% of content width).
    cardRadius: Math.round(contentWidth * 0.028),
    scene: {
      x: bleed + marginX,
      y: bleed + marginY,
      width: contentWidth - marginX * 2,
      height: contentHeight - marginY * 2,
      radius: Math.round(contentWidth * 0.014)
    },
    indexInset: bleed + indexInset,
    indexWidth,
    indexHeight,
    outerStroke: Math.max(2, Math.round(contentWidth * 0.004)),
    frameGap: Math.max(3, Math.round(contentWidth * 0.005)),
    frameOuter: Math.max(3, Math.round(contentWidth * 0.0055)),
    frameInner: Math.max(2, Math.round(contentWidth * 0.0035))
  }
}

function usesFoilChrome(card: RenderCard) {
  return card.suit === 'trumps' || card.role === 'king' || card.role === 'queen'
}

function getCardColor(card: RenderCard) {
  if (card.suit === 'hearts' || card.suit === 'diamonds') {
    return '#b42318'
  }

  if (card.suit === 'trumps') {
    return FOIL_GOLD.mid
  }

  return '#1c1917'
}

function getFoilGradientDefs() {
  return `
    <linearGradient id="foilGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${FOIL_GOLD.light}"/>
      <stop offset="45%" stop-color="${FOIL_GOLD.mid}"/>
      <stop offset="100%" stop-color="${FOIL_GOLD.dark}"/>
    </linearGradient>
  `
}

/** Frames / outer strokes use metallic gold for luxury cards; indices keep suit ink. */
function getChromeFill(card: RenderCard) {
  return usesFoilChrome(card) ? 'url(#foilGold)' : getCardColor(card)
}

function getIndexStrokeColor(card: RenderCard) {
  if (usesFoilChrome(card)) {
    return 'rgba(197, 160, 53, 0.28)'
  }

  if (card.suit === 'hearts' || card.suit === 'diamonds') {
    return 'rgba(180, 35, 24, 0.18)'
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

function drawIndex(card: RenderCard, layout: CardLayout, x: number, y: number, rotate: boolean, fill?: string) {
  // Ink color for indices (red/black/gold). Foil mask passes black via `fill`.
  const color = fill || getCardColor(card)
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
  const stroke = getChromeFill(card)
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
        ${getFoilGradientDefs()}
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
        stroke="${stroke}"
        stroke-opacity="0.88"
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
    contentX,
    contentY,
    contentWidth,
    contentHeight,
    cardRadius,
    indexInset,
    indexWidth,
    indexHeight,
    outerStroke
  } = layout
  const stroke = getChromeFill(card)
  const outerInset = Math.round(contentWidth * 0.012)
  const bottomIndexX = contentX + contentWidth - (indexInset - contentX) - indexWidth
  const bottomIndexY = contentY + contentHeight - (indexInset - contentY) - indexHeight

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${getFoilGradientDefs()}
        <filter id="paperGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0.9  0 0 0 0 0.88  0 0 0 0 0.84  0 0 0 0.04 0"/>
        </filter>
      </defs>

      <rect
        x="${contentX + outerInset}"
        y="${contentY + outerInset}"
        width="${contentWidth - outerInset * 2}"
        height="${contentHeight - outerInset * 2}"
        rx="${Math.max(2, cardRadius - outerInset)}"
        fill="none"
        stroke="${stroke}"
        stroke-opacity="0.35"
        stroke-width="${outerStroke}"
      />

      <rect width="${width}" height="${height}" filter="url(#paperGrain)" opacity="1"/>

      ${drawIndex(card, layout, indexInset, indexInset, false)}
      ${drawIndex(card, layout, bottomIndexX, bottomIndexY, true)}
    </svg>
  `)
}

/** Hot-foil stamp mask: black = foil, white = no foil. Generated in-app for the printer. */
function buildFoilMaskOverlay(card: RenderCard, layout: CardLayout) {
  const {
    width,
    height,
    contentX,
    contentY,
    contentWidth,
    contentHeight,
    cardRadius,
    scene,
    frameGap,
    frameOuter,
    frameInner,
    outerStroke
  } = layout
  const outerInset = Math.round(contentWidth * 0.012)
  const outerRx = Math.max(2, scene.radius)
  const innerRx = Math.max(2, scene.radius - frameGap - frameOuter)
  const foil = FOIL_MASK_BLACK

  // Frames only — never indices or suit pips (those stay red/black ink).
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#ffffff"/>

      <rect
        x="${contentX + outerInset}"
        y="${contentY + outerInset}"
        width="${contentWidth - outerInset * 2}"
        height="${contentHeight - outerInset * 2}"
        rx="${Math.max(2, cardRadius - outerInset)}"
        fill="none"
        stroke="${foil}"
        stroke-width="${outerStroke}"
      />

      <rect
        x="${scene.x}"
        y="${scene.y}"
        width="${scene.width}"
        height="${scene.height}"
        rx="${outerRx}"
        fill="none"
        stroke="${foil}"
        stroke-width="${frameOuter}"
      />

      <rect
        x="${scene.x + frameGap + frameOuter}"
        y="${scene.y + frameGap + frameOuter}"
        width="${scene.width - (frameGap + frameOuter) * 2}"
        height="${scene.height - (frameGap + frameOuter) * 2}"
        rx="${innerRx}"
        fill="none"
        stroke="${foil}"
        stroke-width="${Math.max(1, frameInner)}"
      />
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
export async function renderCardImage(
  source: Buffer,
  card: RenderCard,
  foreground?: Buffer,
  profile: RenderProfile = 'screen'
) {
  await ensureIndexFont()
  const layout = getCardLayout(card.aspectRatio, profile)
  const { width, height, bleed, contentWidth, contentHeight, cardRadius, scene } = layout
  const sceneImage = await buildSceneImage(source, scene.width, scene.height, scene.radius)
  const foregroundImage = foreground
    ? await buildForegroundImage(foreground, contentWidth, contentHeight)
    : null
  const layers = [
    { input: sceneImage, top: scene.y, left: scene.x },
    { input: buildSceneFrameOverlay(card, layout), top: 0, left: 0 }
  ]

  if (foregroundImage) {
    layers.push({ input: foregroundImage, top: bleed, left: bleed })
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

  // Print keeps square bleed edges for the press; screen gets rounded corners.
  if (profile === 'print') {
    return flat
  }

  return applyCardCornerMask(flat, width, height, cardRadius)
}

/** Black-on-white foil stamp plate for hot-foil printing (generated in-app). */
export async function renderCardFoilMask(card: RenderCard, profile: RenderProfile = 'print') {
  await ensureIndexFont()
  const layout = getCardLayout(card.aspectRatio, profile)

  return sharp(buildFoilMaskOverlay(card, layout))
    .png()
    .toBuffer()
}

/**
 * Surgical face foil: painted gold in the artwork (costume trim, jewelry…)
 * optionally unioned with geometric chrome foil (frames only — never suit pips / indices).
 */
export async function renderSurgicalCardFoilMask(options: {
  card: RenderCard
  faceImage: Buffer
  profile?: RenderProfile
  includeChrome?: boolean
}) {
  const { clearIndexCornersFromFoilMask, extractGoldFoilMask, foilOptionsCostume, unionFoilMasks } = await import('~~/server/utils/foilMask')
  const profile = options.profile || 'print'
  const layout = getCardLayout(options.card.aspectRatio, profile)
  let surgical = await extractGoldFoilMask(options.faceImage, foilOptionsCostume)
  surgical = await sharp(surgical)
    .resize(layout.width, layout.height, { fit: 'fill' })
    .png()
    .toBuffer()
  // Keep R / suit pips as ink: wipe foil noise from index corners.
  surgical = await clearIndexCornersFromFoilMask(surgical, layout)

  if (options.includeChrome === false) {
    return surgical
  }

  const chrome = await renderCardFoilMask(options.card, profile)
  return unionFoilMasks(surgical, chrome)
}

type CardBackOptions = {
  aspectRatio: RenderCard['aspectRatio']
  profile?: RenderProfile
  withFoilChrome?: boolean
}

/** Full-bleed card back — no overlaid geometric chrome (it cuts ornate motifs). */
export async function renderCardBackImage(source: Buffer, options: CardBackOptions) {
  const profile = options.profile || 'screen'
  const layout = getCardLayout(options.aspectRatio, profile)
  const { width, height, bleed, contentWidth, contentHeight, cardRadius } = layout
  const art = await sharp(source)
    .resize(contentWidth, contentHeight, { fit: 'cover', position: 'attention' })
    .png()
    .toBuffer()

  const flat = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 250, g: 248, b: 244, alpha: 1 }
    }
  })
    .composite([{ input: art, top: bleed, left: bleed }])
    .png()
    .toBuffer()

  if (profile === 'print') {
    return flat
  }

  return applyCardCornerMask(flat, width, height, cardRadius)
}

/**
 * Foil mask for the card back: surgical extraction of painted gold in the artwork.
 * Falls back to empty (all white) if no gold is detected.
 */
export async function renderCardBackFoilMaskFromArt(art: Buffer) {
  const { extractGoldFoilMask, foilOptionsOrnament } = await import('~~/server/utils/foilMask')
  return extractGoldFoilMask(art, foilOptionsOrnament)
}

/** @deprecated Prefer renderCardBackFoilMaskFromArt — geometric frames cut motifs. */
export async function renderCardBackFoilMask(aspectRatio: RenderCard['aspectRatio'], profile: RenderProfile = 'print') {
  const layout = getCardLayout(aspectRatio, profile)
  const svg = Buffer.from(`
    <svg width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${layout.width}" height="${layout.height}" fill="#ffffff"/>
    </svg>
  `)

  return sharp(svg).png().toBuffer()
}

/**
 * Upscale a screen-resolution final PNG to the print canvas (trim + bleed).
 * Prefer re-compositing from scene+foreground when available; this is the fallback.
 */
export async function upscaleToPrintCanvas(source: Buffer, aspectRatio: RenderCard['aspectRatio']) {
  const layout = getCardLayout(aspectRatio, 'print')
  const { width, height, bleed, contentWidth, contentHeight } = layout
  const resized = await sharp(source)
    .resize(contentWidth, contentHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 250, g: 248, b: 244, alpha: 1 }
    }
  })
    .composite([{ input: resized, top: bleed, left: bleed }])
    .png()
    .toBuffer()
}
