import sharp from 'sharp'

export type GoldFoilExtractOptions = {
  /** Inclusive hue range in degrees for gold / bronze / amber. */
  hueMin?: number
  hueMax?: number
  /** Minimum saturation 0–1. */
  minSaturation?: number
  /** Minimum value/brightness 0–1. */
  minValue?: number
  /** Maximum value (exclude near-white speculars). */
  maxValue?: number
  /** Dilate foil (black) this many pixels to connect thin filigree. */
  dilatePx?: number
  /** Erode after dilate to pull edges back (keep ≥0). */
  erodePx?: number
}

const defaults: Required<GoldFoilExtractOptions> = {
  hueMin: 28,
  hueMax: 58,
  minSaturation: 0.28,
  minValue: 0.35,
  maxValue: 0.97,
  dilatePx: 1,
  erodePx: 0
}

/** Card backs: thin filigree on dark fields. */
export const foilOptionsOrnament: GoldFoilExtractOptions = {
  hueMin: 22,
  hueMax: 60,
  minSaturation: 0.22,
  minValue: 0.32,
  maxValue: 0.98,
  dilatePx: 2,
  erodePx: 1
}

/** Card faces: costume trim / crown / jewelry — avoid red robes and skin. */
export const foilOptionsCostume: GoldFoilExtractOptions = {
  hueMin: 32,
  hueMax: 56,
  minSaturation: 0.38,
  minValue: 0.42,
  maxValue: 0.96,
  dilatePx: 2,
  erodePx: 1
}

function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let hue = 0
  if (delta > 1e-6) {
    if (max === rn) {
      hue = 60 * (((gn - bn) / delta) % 6)
    } else if (max === gn) {
      hue = 60 * ((bn - rn) / delta + 2)
    } else {
      hue = 60 * ((rn - gn) / delta + 4)
    }
  }

  if (hue < 0) {
    hue += 360
  }

  const saturation = max <= 1e-6 ? 0 : delta / max
  return { hue, saturation, value: max }
}

function isGoldPixel(r: number, g: number, b: number, a: number, opts: Required<GoldFoilExtractOptions>) {
  if (a < 180) {
    return false
  }

  // Reject red / magenta inks (hearts, diamonds, lips, red velvet).
  if (r > g + 40 && r > b + 40 && g < 140) {
    return false
  }

  const { hue, saturation, value } = rgbToHsv(r, g, b)
  const inHue = hue >= opts.hueMin && hue <= opts.hueMax

  if (inHue && saturation >= opts.minSaturation && value >= opts.minValue && value <= opts.maxValue) {
    // Gold is yellow-forward: R and G both high, R not far behind G.
    return r + 40 >= g && g >= b + 15
  }

  // Narrow bronze fallback (dull metal without strong HSV yellow).
  return r >= 145
    && g >= 105
    && g <= r + 10
    && b <= g * 0.62
    && (r + g) / 2 - b >= 40
    && saturation >= 0.3
    && value >= 0.42
    && value <= 0.92
}

function dilateBlack(mask: Uint8Array, width: number, height: number, radius: number) {
  if (radius <= 0) {
    return mask
  }

  const out = new Uint8Array(mask.length)
  out.fill(255)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let black = false

      for (let oy = -radius; oy <= radius && !black; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          const nx = Math.min(width - 1, Math.max(0, x + ox))
          const ny = Math.min(height - 1, Math.max(0, y + oy))
          if ((mask[ny * width + nx] || 0) < 128) {
            black = true
            break
          }
        }
      }

      out[y * width + x] = black ? 0 : 255
    }
  }

  return out
}

function erodeBlack(mask: Uint8Array, width: number, height: number, radius: number) {
  if (radius <= 0) {
    return mask
  }

  const out = new Uint8Array(mask.length)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = true

      for (let oy = -radius; oy <= radius && keep; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          const nx = Math.min(width - 1, Math.max(0, x + ox))
          const ny = Math.min(height - 1, Math.max(0, y + oy))
          if ((mask[ny * width + nx] || 0) >= 128) {
            keep = false
            break
          }
        }
      }

      out[y * width + x] = keep ? 0 : 255
    }
  }

  return out
}

/** Drop isolated foil pixels (noise) while keeping connected filigree. */
function despeckleBlack(mask: Uint8Array, width: number, height: number) {
  const out = new Uint8Array(mask)

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x
      if ((mask[i] || 0) >= 128) {
        continue
      }

      let neighbors = 0
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) {
            continue
          }
          if ((mask[(y + oy) * width + (x + ox)] || 0) < 128) {
            neighbors += 1
          }
        }
      }

      if (neighbors <= 2) {
        out[i] = 255
      }
    }
  }

  return out
}

/**
 * Build a hot-foil stamp plate from painted gold in an image.
 * Black = stamp foil, white = no foil.
 * Uses HSV + warm-metallic fallback so filigree, crowns, and costume trim register.
 */
export async function extractGoldFoilMask(
  source: Buffer,
  options: GoldFoilExtractOptions = {}
) {
  const opts = { ...defaults, ...options }
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width
  const height = info.height
  const mask = new Uint8Array(width * height)

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i] || 0
    const g = data[i + 1] || 0
    const b = data[i + 2] || 0
    const a = data[i + 3] || 0
    mask[p] = isGoldPixel(r, g, b, a, opts) ? 0 : 255
  }

  let cleaned = dilateBlack(mask, width, height, opts.dilatePx)
  cleaned = erodeBlack(cleaned, width, height, opts.erodePx)
  cleaned = despeckleBlack(cleaned, width, height)

  const rgb = Buffer.alloc(width * height * 3)
  for (let p = 0, o = 0; p < cleaned.length; p += 1, o += 3) {
    // Important: 0 is a valid foil pixel — never use `|| 255` (falsy zero bug).
    const v = cleaned[p] ?? 255
    rgb[o] = v
    rgb[o + 1] = v
    rgb[o + 2] = v
  }

  return sharp(rgb, {
    raw: { width, height, channels: 3 }
  })
    .png()
    .toBuffer()
}

/**
 * Union two foil masks (black wins). Both must be same size.
 */
export async function unionFoilMasks(a: Buffer, b: Buffer) {
  const left = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const right = await sharp(b)
    .resize(left.info.width, left.info.height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const out = Buffer.alloc(left.info.width * left.info.height * 3)

  for (let i = 0, p = 0; i < left.data.length; i += 4, p += 3) {
    const black = (left.data[i] || 0) < 128 || (right.data[i] || 0) < 128
    const v = black ? 0 : 255
    out[p] = v
    out[p + 1] = v
    out[p + 2] = v
  }

  return sharp(out, {
    raw: {
      width: left.info.width,
      height: left.info.height,
      channels: 3
    }
  })
    .png()
    .toBuffer()
}

/** Share of foil (black) pixels — useful for diagnostics. */
export async function measureFoilCoverage(mask: Buffer) {
  const { data, info } = await sharp(mask).greyscale().raw().toBuffer({ resolveWithObject: true })
  let black = 0

  for (let i = 0; i < data.length; i += 1) {
    if ((data[i] || 0) < 128) {
      black += 1
    }
  }

  return {
    width: info.width,
    height: info.height,
    blackPixels: black,
    coverage: black / Math.max(1, info.width * info.height)
  }
}

type IndexSafeLayout = {
  width: number
  height: number
  indexInset: number
  indexWidth: number
  indexHeight: number
  contentX: number
  contentY: number
  contentWidth: number
  contentHeight: number
}

/**
 * Force index corners white so R / suit pips stay ink (never foil).
 */
export async function clearIndexCornersFromFoilMask(mask: Buffer, layout: IndexSafeLayout) {
  const bottomIndexX = layout.contentX + layout.contentWidth - (layout.indexInset - layout.contentX) - layout.indexWidth
  const bottomIndexY = layout.contentY + layout.contentHeight - (layout.indexInset - layout.contentY) - layout.indexHeight
  const pad = Math.round(layout.indexWidth * 0.2)

  const overlay = Buffer.from(`
    <svg width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="${layout.indexInset - pad}"
        y="${layout.indexInset - pad}"
        width="${layout.indexWidth + pad * 2}"
        height="${layout.indexHeight + pad * 2}"
        fill="#ffffff"
      />
      <rect
        x="${bottomIndexX - pad}"
        y="${bottomIndexY - pad}"
        width="${layout.indexWidth + pad * 2}"
        height="${layout.indexHeight + pad * 2}"
        fill="#ffffff"
      />
    </svg>
  `)

  return sharp(mask)
    .composite([{ input: overlay, blend: 'over' }])
    .png()
    .toBuffer()
}
