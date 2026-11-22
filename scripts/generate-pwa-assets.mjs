#!/usr/bin/env node
/**
 * Home-screen app assets: icons (any, maskable, Apple), favicon and the iOS
 * start-up screens listed in shared/pwa/splashScreens.ts.
 * Usage: node scripts/generate-pwa-assets.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import opentype from 'opentype.js'
import { SPLASH_DEVICES, splashFileName } from '../shared/pwa/splashScreens.ts'

const root = process.cwd()
const pub = join(root, 'public')
const pwaDir = join(pub, 'pwa')
mkdirSync(pwaDir, { recursive: true })

const INK = '#0c0908'
const GOLD = '#d9b26a'
const GOLD_LIGHT = '#f3d48f'

// Spade drawn in a 100×100 box, centred on (50, 50).
const SPADE = 'M50 8C50 8 14 36 14 57C14 70 23 78 34 78C41 78 46 74.5 48.5 70C47.5 80 43 87.5 35 93H65C57 87.5 52.5 80 51.5 70C54 74.5 59 78 66 78C77 78 86 70 86 57C86 36 50 8 50 8Z'

function defs() {
  return `<defs>
    <radialGradient id="felt" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#2f6a47"/>
      <stop offset="65%" stop-color="#1d4a31"/>
      <stop offset="100%" stop-color="#112c1d"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${GOLD_LIGHT}"/>
      <stop offset="100%" stop-color="${GOLD}"/>
    </linearGradient>
  </defs>`
}

/** Full-bleed icon: felt, gold ring and spade inside the 80% maskable safe zone. */
function iconSvg(size, { ring = true, spadeScale = 0.56 } = {}) {
  const s = spadeScale
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    ${defs()}
    <rect width="100" height="100" fill="url(#felt)"/>
    ${ring ? `<circle cx="50" cy="50" r="37" fill="none" stroke="url(#gold)" stroke-width="1.6" opacity="0.85"/>` : ''}
    <g transform="translate(50 51) scale(${s}) translate(-50 -50)">
      <path d="${SPADE}" fill="#000" opacity="0.35" transform="translate(0 2.5)"/>
      <path d="${SPADE}" fill="url(#gold)"/>
    </g>
  </svg>`
}

/** Small favicon: no ring (unreadable at 16 px), larger spade. */
function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    ${defs()}
    <rect width="100" height="100" rx="22" fill="url(#felt)"/>
    <g transform="translate(50 51) scale(0.74) translate(-50 -50)"><path d="${SPADE}" fill="url(#gold)"/></g>
  </svg>`
}

const fontFile = readFileSync(join(pub, 'fonts/LiberationSerif-Bold.ttf'))
const font = opentype.parse(fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength))

function textPath(text, x, y, size, fill, letterSpacing = 0) {
  const width = font.getAdvanceWidth(text, size) + letterSpacing * (text.length - 1)
  let cursor = x - width / 2
  let d = ''
  for (const char of text) {
    d += font.getPath(char, cursor, y, size).toPathData(2)
    cursor += font.getAdvanceWidth(char, size) + letterSpacing
  }
  return `<path d="${d}" fill="${fill}"/>`
}

function splashSvg(w, h) {
  const unit = Math.min(w, h)
  const medal = unit * 0.3
  const cx = w / 2
  const cy = h / 2 - unit * 0.08
  const titleSize = unit * 0.085
  const subSize = unit * 0.034
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${defs()}
    <rect width="${w}" height="${h}" fill="${INK}"/>
    <g transform="translate(${cx - medal / 2} ${cy - medal / 2}) scale(${medal / 100})">
      <circle cx="50" cy="50" r="50" fill="url(#felt)"/>
      <circle cx="50" cy="50" r="47" fill="none" stroke="url(#gold)" stroke-width="2"/>
      <g transform="translate(50 51) scale(0.6) translate(-50 -50)"><path d="${SPADE}" fill="url(#gold)"/></g>
    </g>
    ${textPath('Cards', cx, cy + medal / 2 + titleSize * 1.35, titleSize, GOLD_LIGHT, titleSize * 0.04)}
    ${textPath('TAROT ENTRE AMIS', cx, cy + medal / 2 + titleSize * 1.35 + subSize * 2.2, subSize, 'rgba(243,212,143,0.55)', subSize * 0.25)}
  </svg>`
}

async function png(svg, out, size) {
  let img = sharp(Buffer.from(svg))
  if (size) {
    img = img.resize(size, size)
  }
  await img.png({ compressionLevel: 9 }).toFile(out)
}

await png(iconSvg(512), join(pub, 'icon-512.png'))
await png(iconSvg(512), join(pub, 'icon-192.png'), 192)
await png(iconSvg(512, { ring: false, spadeScale: 0.5 }), join(pub, 'icon-maskable-512.png'))
await png(iconSvg(512, { ring: false, spadeScale: 0.5 }), join(pub, 'icon-maskable-192.png'), 192)
// iOS rounds the corners itself and fills transparency with black: keep it opaque.
await sharp(Buffer.from(iconSvg(512))).resize(180, 180).flatten({ background: INK }).png({ compressionLevel: 9 }).toFile(join(pub, 'apple-touch-icon.png'))
writeFileSync(join(pub, 'favicon.svg'), faviconSvg().replace(/\s+/g, ' ').trim() + '\n')
// favicon.ico holding one 32×32 PNG (valid ICO since Windows Vista, read by every browser).
const ico32 = await sharp(Buffer.from(faviconSvg())).resize(32, 32).png().toBuffer()
const icoHeader = Buffer.alloc(22)
icoHeader.writeUInt16LE(0, 0)
icoHeader.writeUInt16LE(1, 2)
icoHeader.writeUInt16LE(1, 4)
icoHeader.writeUInt8(32, 6)
icoHeader.writeUInt8(32, 7)
icoHeader.writeUInt16LE(1, 10)
icoHeader.writeUInt16LE(32, 12)
icoHeader.writeUInt32LE(ico32.length, 14)
icoHeader.writeUInt32LE(22, 18)
writeFileSync(join(pub, 'favicon.ico'), Buffer.concat([icoHeader, ico32]))

for (const device of SPLASH_DEVICES) {
  for (const orientation of ['portrait', 'landscape']) {
    const pw = device.width * device.ratio
    const ph = device.height * device.ratio
    const [w, h] = orientation === 'portrait' ? [pw, ph] : [ph, pw]
    await png(splashSvg(w, h), join(pwaDir, splashFileName(device, orientation)))
  }
}

console.log('PWA assets written to public/ and public/pwa/')
