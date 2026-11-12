import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const generateImage = vi.fn()

vi.mock('ai', () => ({ generateImage }))
vi.mock('@ai-sdk/google', () => ({ google: { image: (id: string) => ({ modelId: id }) } }))

const runtimeConfig = { aiImageModel: '' }

describe('card image model', () => {
  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)
    generateImage.mockReset()
    runtimeConfig.aiImageModel = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses Nano Banana 2.1 by default, with the stable model as fallback', async () => {
    const { getAiImageModelIds } = await import('../../server/utils/ai')
    expect(getAiImageModelIds()).toEqual(['gemini-nano-banana-2.1', 'gemini-3.1-flash-image'])
  })

  it('follows NUXT_AI_IMAGE_MODEL', async () => {
    runtimeConfig.aiImageModel = 'gemini-3-pro-image'
    const { getAiImageModelIds } = await import('../../server/utils/ai')
    expect(getAiImageModelIds()[0]).toBe('gemini-3-pro-image')
  })

  it('recognises an unknown model error', async () => {
    const { isModelUnavailableError } = await import('../../server/utils/ai')
    expect(isModelUnavailableError(Object.assign(new Error('Not Found'), { statusCode: 404 }))).toBe(true)
    expect(isModelUnavailableError(new Error('models/gemini-nano-banana-2.1 is not found for API version v1beta'))).toBe(true)
    expect(isModelUnavailableError(Object.assign(new Error('Resource exhausted'), { statusCode: 429 }))).toBe(false)
    expect(isModelUnavailableError(new Error('The response was blocked due to safety'))).toBe(false)
  })

  it('falls back to the stable model when the configured one does not exist', async () => {
    const { generateCardImage } = await import('../../server/utils/ai')
    generateImage
      .mockRejectedValueOnce(Object.assign(new Error('models/gemini-nano-banana-2.1 is not found'), { statusCode: 404 }))
      .mockResolvedValueOnce({ image: { uint8Array: new Uint8Array([1]) } })

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await generateCardImage({ prompt: 'test', aspectRatio: '2:3' })
    warn.mockRestore()

    expect(result.image.uint8Array).toHaveLength(1)
    expect(generateImage.mock.calls.map(([input]) => input.model.modelId)).toEqual(['gemini-nano-banana-2.1', 'gemini-3.1-flash-image'])
  })

  it('does not hide other errors behind the fallback', async () => {
    const { generateCardImage } = await import('../../server/utils/ai')
    generateImage.mockRejectedValueOnce(Object.assign(new Error('Resource exhausted'), { statusCode: 429 }))

    await expect(generateCardImage({ prompt: 'test' })).rejects.toThrow('Resource exhausted')
    expect(generateImage).toHaveBeenCalledTimes(1)
  })
})
