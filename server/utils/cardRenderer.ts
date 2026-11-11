import sharp from 'sharp'
import type { Font, Path } from 'opentype.js'
import { ensureIndexFont, getIndexFont } from '~~/server/utils/indexFont'
import type { CardTheme, CardThemeId } from '~~/shared/utils/cardThemes'
import { getCardTheme } from '~~/shared/utils/cardThemes'
import type { CardFormat, CardFormatId, RenderProfile } from '~~/shared/utils/printSpec'
import { getCanvasPx, getCardFormat, getCardLayoutRatios } from '~~/shared/utils/printSpec'

type RenderCard = {
  label: string
  shortLabel: string
  rank?: string
  role?: string
  suit?: string
}

type Rect = {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

/**
 * One layout for every card of a deck (faces AND back), so the contour,
 * the frame and the index corners sit at exactly the same place everywhere.
 * All sizes are derived from the trim width so screen and print match.
 */
export type CardLayout = {
  width: number
  height: number
  bleed: number
  contentWidth: number
  contentHeight: number
  cardRadius: number
  /** Outer contour line, same on faces and back. */
  contour: Rect
  contourStroke: number
  /** Illustration window (scene on faces, pattern on the back). */
  window: Rect
  frameStroke: number
  hairlineStroke: number
  hairlineGap: number
  index: {
    x: number
    y: number
    width: number
    rankHeight: number
    pipSize: number
    gap: number
    height: number
  }
  /** Highest point the character may reach (it must never cover an index). */
  foregroundTop: number
}

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

function round(value: number) {
  return Math.round(value * 100) / 100
}

export function getCardLayout(format: CardFormat, profile: RenderProfile = 'screen'): CardLayout {
  const canvas = getCanvasPx(format, profile)
  const ratios = getCardLayoutRatios(format)
  const bleed = canvas.bleed
  const cw = canvas.width - bleed * 2
  const ch = canvas.height - bleed * 2
  const unit = (ratio: number) => Math.round(cw * ratio)

  const contourInset = unit(ratios.contourInset)
  const contourStroke = Math.max(2, unit(ratios.contourStroke))
  const indexX = unit(ratios.indexX)
  const indexY = unit(ratios.indexY)
  const indexWidth = unit(ratios.indexWidth)
  const rankHeight = unit(ratios.rankHeight)
  const pipSize = unit(ratios.pipSize)
  const indexGap = unit(ratios.indexGap)
  const indexHeight = rankHeight + indexGap + pipSize

  // Side: indices in a column beside the window (wide poker cards).
  // Band: indices above / below the window, which then spans almost the full
  // width — on a 61 × 112 mm tarot card a side column would leave a sliver.
  const band = ratios.layout === 'band'
  const windowX = band ? unit(ratios.windowX) : indexX + indexWidth + unit(ratios.windowGap)
  const windowY = band ? indexY + indexHeight + unit(ratios.windowGap) : indexY
  // Side: the character may rise up to the card edge area (pop-out).
  // Band: it may rise into the band, but stays below the index row.
  const foregroundTop = band
    ? bleed + indexY + indexHeight + unit(ratios.foregroundGap)
    : bleed + Math.round(windowY * 0.2)

  return {
    width: canvas.width,
    height: canvas.height,
    bleed,
    contentWidth: cw,
    contentHeight: ch,
    cardRadius: unit(ratios.cardRadius),
    contour: {
      x: bleed + contourInset,
      y: bleed + contourInset,
      width: cw - contourInset * 2,
      height: ch - contourInset * 2,
      radius: unit(ratios.contourRadius)
    },
    contourStroke,
    window: {
      x: bleed + windowX,
      y: bleed + windowY,
      width: cw - windowX * 2,
      height: ch - windowY * 2,
      radius: unit(ratios.windowRadius)
    },
    frameStroke: Math.max(2, unit(ratios.frameStroke)),
    hairlineStroke: Math.max(1, unit(ratios.hairlineStroke)),
    hairlineGap: Math.max(2, unit(ratios.hairlineGap)),
    index: {
      x: bleed + indexX,
      y: bleed + indexY,
      width: indexWidth,
      rankHeight,
      pipSize,
      gap: indexGap,
      height: indexHeight
    },
    foregroundTop
  }
}

/** Back uses the same contour, with the pattern window just inside it. */
function getBackWindow(layout: CardLayout): Rect {
  const inset = Math.round(layout.contentWidth * 0.03)

  return {
    x: layout.contour.x + inset,
    y: layout.contour.y + inset,
    width: layout.contour.width - inset * 2,
    height: layout.contour.height - inset * 2,
    radius: layout.window.radius
  }
}

function isRedSuit(card: RenderCard) {
  return card.suit === 'hearts' || card.suit === 'diamonds'
}

function getInk(card: RenderCard, theme: CardTheme) {
  return isRedSuit(card) ? theme.colors.redInk : theme.colors.darkInk
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

function rectSvg(rect: Rect, attrs: string, offset = 0) {
  return `<rect x="${round(rect.x - offset)}" y="${round(rect.y - offset)}" width="${round(rect.width + offset * 2)}" height="${round(rect.height + offset * 2)}" rx="${round(Math.max(1, rect.radius + offset))}" ${attrs}/>`
}

/** Glyph outline + its tight bounding box at a given size. */
function glyphOutline(font: Font, char: string, fontSize: number) {
  const glyph = font.charToGlyph(char)
  const path: Path = glyph.getPath(0, 0, fontSize)
  const box = path.getBoundingBox()

  return { path, box }
}

/**
 * Index rank drawn from real font outlines (Sharp cannot rasterize <text> reliably).
 * Every rank shares the same cap height on every card; glyphs are laid out
 * from their real bounding boxes (not advance widths) so they are optically
 * centred, and two-digit ranks ("10", "21") are tightened then condensed
 * horizontally instead of being shrunk.
 */
function drawRank(label: string, centerX: number, top: number, maxWidth: number, capHeight: number, color: string) {
  const text = label.slice(0, 2).toUpperCase()

  if (!text) {
    return ''
  }

  const font = getIndexFont()
  const reference = glyphOutline(font, 'H', 100)
  const referenceHeight = reference.box.y2 - reference.box.y1 || 66
  const fontSize = (capHeight / referenceHeight) * 100
  const tracking = fontSize * 0.06
  const glyphs = [...text].map(char => glyphOutline(font, char, fontSize))
  const parts: string[] = []
  let cursor = 0

  for (const { path, box } of glyphs) {
    const dx = cursor - box.x1
    parts.push(`<path transform="translate(${round(dx)} 0)" d="${path.toPathData(2)}"/>`)
    cursor += box.x2 - box.x1 + tracking
  }

  const totalWidth = cursor - tracking
  const scaleX = totalWidth > maxWidth ? maxWidth / totalWidth : 1
  const baseline = top + capHeight
  const startX = centerX - (totalWidth * scaleX) / 2

  return `<g fill="${color}" transform="translate(${round(startX)} ${round(baseline)}) scale(${round(scaleX * 1000) / 1000} 1)">${parts.join('')}</g>`
}

function drawSuit(suit: string | undefined, cx: number, cy: number, size: number, color: string) {
  const half = size / 2
  const quarter = size / 4
  const fill = `fill="${color}"`

  if (suit === 'hearts') {
    const scale = size / 100

    return `<path ${fill} transform="translate(${round(cx)} ${round(cy + size * 0.06)}) scale(${round(scale * 1000) / 1000})" d="M 0 40 C -6 31 -43 8 -43 -21 C -43 -45 -17 -55 0 -32 C 17 -55 43 -45 43 -21 C 43 8 6 31 0 40 Z"/>`
  }

  if (suit === 'diamonds') {
    return `<polygon ${fill} points="${round(cx)},${round(cy - half)} ${round(cx + half * 0.72)},${round(cy)} ${round(cx)},${round(cy + half)} ${round(cx - half * 0.72)},${round(cy)}"/>`
  }

  if (suit === 'clubs') {
    return [
      `<circle ${fill} cx="${round(cx)}" cy="${round(cy - quarter)}" r="${round(quarter)}"/>`,
      `<circle ${fill} cx="${round(cx - quarter)}" cy="${round(cy + quarter * 0.1)}" r="${round(quarter)}"/>`,
      `<circle ${fill} cx="${round(cx + quarter)}" cy="${round(cy + quarter * 0.1)}" r="${round(quarter)}"/>`,
      `<path ${fill} d="M ${round(cx - quarter * 0.35)} ${round(cy + quarter * 0.2)} L ${round(cx + quarter * 0.35)} ${round(cy + quarter * 0.2)} L ${round(cx + quarter * 0.55)} ${round(cy + half)} L ${round(cx - quarter * 0.55)} ${round(cy + half)} Z"/>`
    ].join('')
  }

  if (suit === 'spades') {
    return [
      `<path ${fill} d="M ${round(cx)} ${round(cy - half * 0.9)} C ${round(cx - half * 0.45)} ${round(cy - half * 0.45)} ${round(cx - half * 0.9)} ${round(cy - half * 0.18)} ${round(cx - half * 0.86)} ${round(cy + quarter * 0.38)} C ${round(cx - half * 0.82)} ${round(cy + quarter * 0.96)} ${round(cx - quarter * 0.14)} ${round(cy + quarter * 1.08)} ${round(cx)} ${round(cy + quarter * 0.2)} C ${round(cx + quarter * 0.14)} ${round(cy + quarter * 1.08)} ${round(cx + half * 0.82)} ${round(cy + quarter * 0.96)} ${round(cx + half * 0.86)} ${round(cy + quarter * 0.38)} C ${round(cx + half * 0.9)} ${round(cy - half * 0.18)} ${round(cx + half * 0.45)} ${round(cy - half * 0.45)} ${round(cx)} ${round(cy - half * 0.9)} Z"/>`,
      `<path ${fill} d="M ${round(cx - quarter * 0.22)} ${round(cy + quarter * 0.12)} C ${round(cx - quarter * 0.12)} ${round(cy + quarter * 0.6)} ${round(cx - quarter * 0.35)} ${round(cy + half * 0.76)} ${round(cx - quarter * 0.62)} ${round(cy + half * 0.84)} L ${round(cx + quarter * 0.62)} ${round(cy + half * 0.84)} C ${round(cx + quarter * 0.35)} ${round(cy + half * 0.76)} ${round(cx + quarter * 0.12)} ${round(cy + quarter * 0.6)} ${round(cx + quarter * 0.22)} ${round(cy + quarter * 0.12)} Z"/>`
    ].join('')
  }

  return ''
}

/** Five-point star: the traditional Excuse index. */
function drawStar(cx: number, cy: number, outerRadius: number, color: string) {
  const innerRadius = outerRadius * 0.42
  const points: string[] = []

  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    points.push(`${round(cx + Math.cos(angle) * radius)},${round(cy + Math.sin(angle) * radius)}`)
  }

  return `<polygon fill="${color}" points="${points.join(' ')}"/>`
}

/** One index corner (rank over suit pip). The opposite corner is the same group rotated 180°. */
function drawIndex(card: RenderCard, layout: CardLayout, theme: CardTheme) {
  const color = getInk(card, theme)
  const { index } = layout
  const centerX = index.x + index.width / 2

  if (card.role === 'excuse') {
    return drawStar(centerX, index.y + index.rankHeight / 2, index.rankHeight * 0.62, color)
  }

  const rank = drawRank(getRankLabel(card), centerX, index.y, index.width, index.rankHeight, color)

  if (card.suit === 'trumps' || !card.suit) {
    return rank
  }

  const pipCy = index.y + index.rankHeight + index.gap + index.pipSize / 2

  return rank + drawSuit(card.suit, centerX, pipCy, index.pipSize, color)
}

function paperGrainDefs() {
  return `
    <filter id="paperGrain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0.05 0"/>
    </filter>
  `
}

/** Paper + outer contour, shared by faces and back. */
function buildBaseLayer(layout: CardLayout, theme: CardTheme) {
  const { width, height, contour, contourStroke } = layout

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>${paperGrainDefs()}</defs>
      <rect width="${width}" height="${height}" fill="${theme.colors.paper}"/>
      <rect width="${width}" height="${height}" filter="url(#paperGrain)"/>
      ${rectSvg(contour, `fill="none" stroke="${theme.colors.frame}" stroke-width="${contourStroke}"`)}
    </svg>
  `)
}

/** Frame around an illustration window: solid frame line + hairline just outside it. */
function buildWindowFrame(layout: CardLayout, theme: CardTheme, window: Rect) {
  const { width, height, frameStroke, hairlineStroke, hairlineGap } = layout

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${rectSvg(window, `fill="none" stroke="${theme.colors.frame}" stroke-width="${frameStroke}"`)}
      ${rectSvg(window, `fill="none" stroke="${theme.colors.hairline}" stroke-width="${hairlineStroke}"`, hairlineGap)}
    </svg>
  `)
}

function buildIndexLayer(card: RenderCard, layout: CardLayout, theme: CardTheme) {
  const { width, height } = layout
  const corner = drawIndex(card, layout, theme)

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <g>${corner}</g>
      <g transform="rotate(180 ${width / 2} ${height / 2})">${corner}</g>
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

async function buildSceneImage(source: Buffer, width: number, height: number, radius: number, position: 'attention' | 'centre' = 'attention') {
  const cropped = await cropSceneSource(source)
  const mask = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" fill="#ffffff"/>
    </svg>
  `)

  return sharp(cropped)
    .resize(width, height, { fit: 'cover', position })
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
 * Character layer: cutout fitted to the scene window, standing on its bottom
 * edge. It may rise above the top frame line (pop-out) but is clipped to the
 * window horizontally and at the bottom, so it never covers the index corners
 * or the outer contour.
 */
async function buildForegroundImage(source: Buffer, layout: CardLayout) {
  const { width, height, window, frameStroke } = layout
  const cutout = await removeChromaGreen(source)
  const trimmed = await sharp(cutout)
    .trim({ threshold: 1 })
    .png()
    .toBuffer()
    .catch(() => cutout)

  const clipLeft = window.x + frameStroke
  const clipRight = window.x + window.width - frameStroke
  const clipBottom = window.y + window.height - frameStroke
  const popOut = Math.max(0, window.y - layout.foregroundTop)
  const boxWidth = Math.round((clipRight - clipLeft) * 0.94)
  const boxHeight = Math.round(window.height * 0.94 + popOut)
  const resized = await sharp(trimmed)
    .resize(boxWidth, boxHeight, {
      fit: 'inside',
      withoutEnlargement: false
    })
    .png()
    .toBuffer({ resolveWithObject: true })

  const left = Math.round(window.x + (window.width - resized.info.width) / 2)
  const top = Math.round(clipBottom - resized.info.height)
  const clip = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${clipLeft}" y="${layout.foregroundTop}" width="${clipRight - clipLeft}" height="${clipBottom - layout.foregroundTop}" fill="#ffffff"/>
    </svg>
  `)

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: resized.data, left, top },
      { input: clip, blend: 'dest-in' }
    ])
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

type RenderOptions = {
  profile?: RenderProfile
  theme?: CardThemeId | string | null
  /** Deck card format; defaults to poker (decks created before formats existed). */
  format?: CardFormatId | null
}

/**
 * Assemble a face from two AI images, always with the same deck layout:
 * paper + contour → scene window + frame → character → indices.
 */
export async function renderCardImage(
  source: Buffer,
  card: RenderCard,
  foreground?: Buffer,
  options: RenderOptions = {}
) {
  await ensureIndexFont()
  const profile = options.profile || 'screen'
  const theme = getCardTheme(options.theme)
  const layout = getCardLayout(getCardFormat(options.format), profile)
  const { width, height, cardRadius, window } = layout
  const sceneImage = await buildSceneImage(source, window.width, window.height, window.radius)
  const layers: sharp.OverlayOptions[] = [
    { input: sceneImage, top: window.y, left: window.x },
    { input: buildWindowFrame(layout, theme, window), top: 0, left: 0 }
  ]

  if (foreground) {
    layers.push({ input: await buildForegroundImage(foreground, layout), top: 0, left: 0 })
  }

  layers.push({ input: buildIndexLayer(card, layout, theme), top: 0, left: 0 })

  const flat = await sharp(buildBaseLayer(layout, theme))
    .composite(layers)
    .png()
    .toBuffer()

  // Print keeps square bleed edges for the press; screen gets rounded corners.
  if (profile === 'print') {
    return flat
  }

  return applyCardCornerMask(flat, width, height, cardRadius)
}

/**
 * The deck's single card back: same paper, same contour and same frame as the
 * faces, with the generated pattern inside. Rendered once per deck and reused
 * for every card, so all backs are strictly identical.
 */
export async function renderCardBackImage(source: Buffer, options: RenderOptions = {}) {
  const profile = options.profile || 'screen'
  const theme = getCardTheme(options.theme)
  const layout = getCardLayout(getCardFormat(options.format), profile)
  const { width, height, cardRadius } = layout
  const window = getBackWindow(layout)
  // Centre crop: an attention crop would break the pattern's symmetry.
  const art = await buildSceneImage(source, window.width, window.height, window.radius, 'centre')

  const flat = await sharp(buildBaseLayer(layout, theme))
    .composite([
      { input: art, top: window.y, left: window.x },
      { input: buildWindowFrame(layout, theme, window), top: 0, left: 0 }
    ])
    .png()
    .toBuffer()

  if (profile === 'print') {
    return flat
  }

  return applyCardCornerMask(flat, width, height, cardRadius)
}

/**
 * Upscale a screen-resolution final PNG to the print canvas (trim + bleed).
 * Bleed is filled with the theme paper colour so the margin continues to the cut.
 */
export async function upscaleToPrintCanvas(
  source: Buffer,
  theme?: CardThemeId | string | null,
  format?: CardFormatId | null
) {
  const layout = getCardLayout(getCardFormat(format), 'print')
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
      background: getCardTheme(theme).colors.paper
    }
  })
    .composite([{ input: resized, top: bleed, left: bleed }])
    .png()
    .toBuffer()
}
