import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import opentype from 'opentype.js'

const FONT_FILE = 'LiberationSerif-Bold.ttf'

let indexFont: opentype.Font | null = null
let indexFontPromise: Promise<opentype.Font> | null = null

function parseFontBuffer(buffer: Buffer | Uint8Array) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)

  return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

function readFontFromFilesystem() {
  const candidates = [
    join(process.cwd(), '.output/public/fonts', FONT_FILE),
    join(process.cwd(), 'public/fonts', FONT_FILE),
    join(process.cwd(), 'server/assets/fonts', FONT_FILE)
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate)
    }
  }

  return null
}

async function loadFontBuffer() {
  try {
    const storage = useStorage('assets:fonts')
    const raw = await storage.getItemRaw(FONT_FILE)

    if (raw) {
      return Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array)
    }
  } catch (error) {
    console.warn('[indexFont] Nitro asset storage unavailable, using filesystem fallback', error)
  }

  const fromDisk = readFontFromFilesystem()

  if (fromDisk) {
    return fromDisk
  }

  throw new Error(`Index font not found (${FONT_FILE}). Checked Nitro assets:fonts and local font directories.`)
}

export async function ensureIndexFont() {
  if (indexFont) {
    return indexFont
  }

  if (!indexFontPromise) {
    indexFontPromise = loadFontBuffer().then((buffer) => {
      indexFont = parseFontBuffer(buffer)
      return indexFont
    })
  }

  return indexFontPromise
}

export function getIndexFont() {
  if (!indexFont) {
    throw new Error('Index font not loaded. Call ensureIndexFont() before rendering card indices.')
  }

  return indexFont
}
