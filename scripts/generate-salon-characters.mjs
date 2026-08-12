#!/usr/bin/env node
/**
 * Generate 10 salon character portraits via Gemini and write to public/salon-cast/.
 * Usage: node --env-file=.env scripts/generate-salon-characters.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateImage } from 'ai'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const CHARACTERS = [
  {
    id: 'aurelien',
    prompt: 'Portrait bust of a refined French man in his 40s for a luxury tarot salon game, warm olive skin, short salt-and-pepper hair, thin gold glasses, black tuxedo and ivory shirt, soft candlelight, painterly illustration, three-quarter view facing camera, no text, no watermark, dark burgundy background',
  },
  {
    id: 'camille',
    prompt: 'Portrait bust of an elegant French woman in her 30s for a luxury card salon, light skin, dark wavy hair pinned up, black velvet jacket, gold silk scarf, subtle makeup, soft chandelier light, painterly illustration, three-quarter view facing camera, no text, no watermark, deep crimson background',
  },
  {
    id: 'hassan',
    prompt: 'Portrait bust of a distinguished Middle Eastern man in his 50s for a luxury tarot salon, deep brown skin, trimmed beard, black dinner jacket, gold lapel pin, calm confident expression, soft warm lighting, painterly illustration, three-quarter view facing camera, no text, no watermark, dark wood panel background',
  },
  {
    id: 'ines',
    prompt: 'Portrait bust of a young Mediterranean woman for a luxury card salon, olive skin, black bob haircut, black tuxedo shirt with gold bow tie, sharp cheekbones, soft candlelight, painterly illustration, three-quarter view facing camera, no text, no watermark, burgundy velvet background',
  },
  {
    id: 'julien',
    prompt: 'Portrait bust of a charismatic French man in his 30s for a luxury tarot salon, fair skin, chestnut hair slicked back, black suit, white shirt, gold pin, slight smirk, warm dramatic lighting, painterly illustration, three-quarter view facing camera, no text, no watermark, dark salon background',
  },
  {
    id: 'lea',
    prompt: 'Portrait bust of a stylish Black French woman in her 30s for a luxury card salon, deep brown skin, short natural hair with gold clip, black blazer, cream blouse, thin gold glasses, poised expression, soft chandelier glow, painterly illustration, three-quarter view facing camera, no text, no watermark, dark crimson background',
  },
  {
    id: 'marco',
    prompt: 'Portrait bust of an Italian man in his 45s for a luxury tarot salon, tanned skin, thick dark hair, black tuxedo, burgundy bow tie, warm smile lines, candlelit ambience, painterly illustration, three-quarter view facing camera, no text, no watermark, wood and velvet background',
  },
  {
    id: 'nadege',
    prompt: 'Portrait bust of a graceful older French woman for a luxury card salon, warm brown skin, silver-streaked hair in a bun, black evening dress with gold scarf, kind intelligent eyes, soft warm light, painterly illustration, three-quarter view facing camera, no text, no watermark, deep burgundy background',
  },
  {
    id: 'olivier',
    prompt: 'Portrait bust of an older French gentleman for a luxury tarot salon, pale skin, white hair, round gold glasses, classic black tuxedo, ivory bow tie, serene expression, soft candlelight, painterly illustration, three-quarter view facing camera, no text, no watermark, dark wood background',
  },
  {
    id: 'sofia',
    prompt: 'Portrait bust of a glamorous South American woman in her 30s for a luxury card salon, golden-brown skin, long dark hair with waves, black satin jacket, gold jewelry pin, confident gaze, dramatic warm lighting, painterly illustration, three-quarter view facing camera, no text, no watermark, crimson velvet background',
  },
]

const outDir = join(root, 'public/salon-cast')
await mkdir(outDir, { recursive: true })

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
if (!apiKey) {
  console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY')
  process.exit(1)
}

const google = createGoogleGenerativeAI({ apiKey })
const model = google.image('gemini-3.1-flash-image-preview')

const only = process.argv.slice(2).filter(a => !a.startsWith('-'))
const list = only.length
  ? CHARACTERS.filter(c => only.includes(c.id))
  : CHARACTERS

for (const character of list) {
  const dest = join(outDir, `${character.id}.png`)
  console.log(`→ ${character.id}…`)
  let lastError
  let image = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await generateImage({
        model,
        prompt: character.prompt,
        aspectRatio: '1:1',
        providerOptions: {
          google: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        },
      })
      if (result.image?.uint8Array?.byteLength) {
        image = result.image
        break
      }
      lastError = new Error(`empty image (try ${attempt})`)
    } catch (error) {
      lastError = error
      console.warn(`  retry ${attempt}:`, error?.message ?? error)
    }
  }
  if (!image?.uint8Array) {
    console.error(`✗ ${character.id}`, lastError)
    continue
  }
  await writeFile(dest, Buffer.from(image.uint8Array))
  console.log(`✓ ${dest} (${image.uint8Array.byteLength} bytes)`)
}

console.log('Done.')
