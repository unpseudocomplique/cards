#!/usr/bin/env node
/**
 * Generate 10 full-body salon avatars via Gemini (head-to-toe seated refs for img2threejs).
 * Usage: node --env-file=.env scripts/generate-salon-characters.mjs [id...]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateImage } from 'ai'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const FRAME = [
  'Full-body 3D character reference for image-to-3D reconstruction.',
  'The ENTIRE figure is visible from the crown of the hair to the soles of the shoes: head, torso, both arms, both hands, both legs, both shoes. No cropping, no close-up bust.',
  'The person is seated in a carved wooden salon armchair, three-quarter view facing the camera, knees and feet clearly visible, hands resting on the thighs.',
  'Luxury French tarot salon, warm candlelight, painterly illustration with readable volumes and a sharp silhouette.',
  'Simple dark burgundy studio background, no ornate picture frame, no text, no watermark.',
  'Vertical composition.'
].join(' ')

function prompt(identity) {
  return `${identity} ${FRAME}`
}

const CHARACTERS = [
  { id: 'aurelien', prompt: prompt('A refined French man in his 40s, warm olive skin, short salt-and-pepper hair, thin gold oval glasses, salt-and-pepper beard, black tuxedo, ivory shirt, black bow tie.') },
  { id: 'camille', prompt: prompt('An elegant French woman in her 30s, light skin, dark wavy hair in an updo with face-framing curls, black velvet jacket, gold silk scarf, gold hoop earrings.') },
  { id: 'hassan', prompt: prompt('A distinguished Middle Eastern man in his 50s, deep brown skin, short cropped hair, trimmed salt-and-pepper beard, black patterned dinner jacket, white shirt, black bow tie, gold compass-rose lapel pin with a red gem.') },
  { id: 'ines', prompt: prompt('A young Mediterranean woman, olive skin, jet-black chin-length bob, black tuxedo shirt, large ornate gold metallic bow tie, sharp cheekbones.') },
  { id: 'julien', prompt: prompt('A charismatic French man in his 30s, fair skin, chestnut hair slicked back, prominent handlebar mustache, charcoal three-piece suit, white shirt, dark necktie, gold eye-of-providence lapel pin.') },
  { id: 'lea', prompt: prompt('A stylish Black French woman in her 30s, deep brown skin, short natural curls with a gold laurel hair clip, round gold glasses, black blazer, cream silk blouse, gold hoop earrings.') },
  { id: 'marco', prompt: prompt('An Italian man in his 45s, tanned skin, thick dark wavy hair, salt-and-pepper beard, black tuxedo, white shirt, burgundy bow tie, warm smile.') },
  { id: 'nadege', prompt: prompt('A graceful older French woman, warm brown skin, silver wavy hair in a low bun, black evening dress, gold-embroidered shawl, gold stud earrings and a small gold necklace.') },
  { id: 'olivier', prompt: prompt('An older French gentleman in his 70s, pale skin, short white hair swept back, round gold glasses, classic black tuxedo, ivory wing collar, white bow tie.') },
  { id: 'sofia', prompt: prompt('A glamorous South American woman in her 30s, golden-brown skin, long dark wavy hair over one shoulder, black satin jacket, gold filigree brooch, gold stud earrings.') }
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
        aspectRatio: '3:4',
        providerOptions: {
          google: {
            responseModalities: ['TEXT', 'IMAGE']
          }
        }
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
