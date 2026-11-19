import { generateCardImage } from '~~/server/utils/ai'
import { buildCardBackPrompt } from '~~/server/utils/cardPromptBuilder'
import { renderCardBackImage } from '~~/server/utils/cardRenderer'
import type { DeckStyleSettings } from '~~/server/utils/db'
import { generateFileKey, uploadFile } from '~~/server/utils/s3'
import { resolveDeckCardFormat } from '~~/shared/utils/printSpec'

function mediaTypeToExtension(mediaType?: string) {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  }

  return extensions[mediaType || ''] || 'png'
}

/**
 * Generate a card back in the deck format and theme, stored under
 * `storagePrefix`. Shared by the deck back and the backs of print variants.
 */
export async function generateCardBack(options: {
  settings: DeckStyleSettings
  promptOverride: string | null
  storagePrefix: string
}) {
  const { settings, promptOverride } = options
  // One back for the whole deck, in the single deck format.
  const format = resolveDeckCardFormat(settings)
  let lastError: unknown
  let image: { uint8Array?: Uint8Array, mediaType?: string } | null = null

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await generateCardImage({
        prompt: buildCardBackPrompt(settings, promptOverride),
        aspectRatio: format.backAspectRatio,
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

      lastError = new Error(`Aucune image générée pour le dos (tentative ${attempt}/3)`)
    } catch (error) {
      lastError = error
    }
  }

  if (!image?.uint8Array) {
    throw lastError instanceof Error ? lastError : new Error('Aucune image générée pour le dos')
  }

  const rawBuffer = Buffer.from(image.uint8Array)
  const mediaType = image.mediaType || 'image/png'
  const rawKey = generateFileKey(options.storagePrefix, `raw.${mediaTypeToExtension(mediaType)}`)
  await uploadFile(rawBuffer, rawKey, mediaType)

  const finalBuffer = await renderCardBackImage(rawBuffer, {
    profile: 'screen',
    theme: settings.colorTheme,
    format: format.id
  })
  const finalKey = generateFileKey(options.storagePrefix, 'final.png')
  const finalUrl = await uploadFile(finalBuffer, finalKey, 'image/png')

  return { finalKey, finalUrl, format: format.id }
}
