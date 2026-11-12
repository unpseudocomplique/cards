import { google } from '@ai-sdk/google'
import { generateImage } from 'ai'

/**
 * Image model used for card faces (scene + character) and the card back.
 * Nano Banana 2.1 by default; override with NUXT_AI_IMAGE_MODEL without a
 * code change (e.g. `gemini-3-pro-image` for Nano Banana Pro).
 */
export const DEFAULT_AI_IMAGE_MODEL = 'gemini-nano-banana-2.1'

/**
 * Used when the configured model is unknown to the API (renamed, retired or
 * not yet available on this key): stable Nano Banana 2.
 */
export const FALLBACK_AI_IMAGE_MODEL = 'gemini-3.1-flash-image'

export function getAiImageModelIds() {
  const configured = String(useRuntimeConfig().aiImageModel || DEFAULT_AI_IMAGE_MODEL).trim()
  return configured === FALLBACK_AI_IMAGE_MODEL ? [configured] : [configured, FALLBACK_AI_IMAGE_MODEL]
}

/** The API rejected the model itself (404, unknown or unsupported model), not the request. */
export function isModelUnavailableError(error: unknown) {
  const status = (error as { statusCode?: number } | null)?.statusCode
  const message = error instanceof Error ? error.message : String(error ?? '')

  return status === 404
    || /models\/[\w.-]+ is not found|is not supported for generatecontent|unknown model|model not found/i.test(message)
}

type CardImageInput = Omit<Parameters<typeof generateImage>[0], 'model'>

/**
 * generateImage with the configured model, falling back to the stable model
 * when the configured one does not exist for this API key.
 */
export async function generateCardImage(input: CardImageInput) {
  const [primary, ...fallbacks] = getAiImageModelIds()

  try {
    return await generateImage({ ...input, model: google.image(primary!) })
  } catch (error) {
    if (!fallbacks.length || !isModelUnavailableError(error)) {
      throw error
    }

    console.warn('[ai] image model unavailable, falling back', {
      model: primary,
      fallback: fallbacks[0],
      message: error instanceof Error ? error.message : String(error)
    })

    return generateImage({ ...input, model: google.image(fallbacks[0]!) })
  }
}
