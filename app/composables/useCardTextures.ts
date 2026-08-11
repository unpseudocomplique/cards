import * as THREE from 'three'
import type { DeckTextureManifest } from '~~/shared/tarot/deckTextures'
import { createPlaceholderImageBitmap } from '~/utils/cardPlaceholderTexture'
import type { PlayQualitySettings } from '~/composables/usePlayQuality'

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load ${url}`))
    image.src = url
  })
}

async function resizeToCanvas(
  source: CanvasImageSource,
  maxTex: number,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const scale = Math.min(1, maxTex / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0, w, h)
  return canvas
}

function textureFromCanvas(canvas: HTMLCanvasElement, anisotropy: number): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(4, anisotropy)
  texture.needsUpdate = true
  return texture
}

export function useCardTextures(code: Ref<string> | string, quality: Ref<PlayQualitySettings>) {
  const codeRef = isRef(code) ? code : ref(code)
  const faces = shallowRef(new Map<string, THREE.Texture>())
  const back = shallowRef<THREE.Texture | null>(null)
  const loading = shallowRef(false)
  const error = shallowRef<string | null>(null)
  const manifest = shallowRef<DeckTextureManifest | null>(null)
  let disposed = false
  let generation = 0
  let pendingPriority: string[] = []
  const loadedCodes = new Set<string>()

  function disposeAll() {
    generation++
    disposed = true
    loadedCodes.clear()
    pendingPriority = []
    for (const texture of faces.value.values()) {
      texture.dispose()
    }
    faces.value = new Map()
    back.value?.dispose()
    back.value = null
  }

  async function loadWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
    let index = 0
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const current = items[index]!
        index++
        await worker(current)
      }
    })
    await Promise.all(runners)
  }

  async function loadFace(cardCode: string, faceUrl: string | null, maxTex: number, gen: number) {
    if (disposed || gen !== generation) {
      return
    }
    try {
      let canvas: HTMLCanvasElement
      if (faceUrl) {
        const image = await loadImageElement(faceUrl)
        canvas = await resizeToCanvas(image, maxTex, image.naturalWidth || image.width, image.naturalHeight || image.height)
      } else {
        canvas = createPlaceholderImageBitmap(cardCode, Math.min(256, maxTex))
      }
      if (disposed || gen !== generation) {
        return
      }
      const texture = textureFromCanvas(canvas, 4)
      const next = new Map(faces.value)
      next.get(cardCode)?.dispose()
      next.set(cardCode, texture)
      faces.value = next
      loadedCodes.add(cardCode)
    } catch {
      if (disposed || gen !== generation) {
        return
      }
      const canvas = createPlaceholderImageBitmap(cardCode, Math.min(256, maxTex))
      const texture = textureFromCanvas(canvas, 4)
      const next = new Map(faces.value)
      next.get(cardCode)?.dispose()
      next.set(cardCode, texture)
      faces.value = next
      loadedCodes.add(cardCode)
    }
  }

  async function prioritize(codes: string[]) {
    pendingPriority = codes
    const data = manifest.value
    if (!data || disposed) {
      return
    }
    const maxTex = quality.value.maxTex
    const gen = generation
    const wanted = data.cards.filter(card => codes.includes(card.cardCode) && !loadedCodes.has(card.cardCode))
    await loadWithConcurrency(wanted, 6, async (card) => {
      await loadFace(card.cardCode, card.faceUrl, maxTex, gen)
    })
  }

  async function reload() {
    const gameCode = codeRef.value
    if (!import.meta.client || !gameCode) {
      return
    }
    disposed = false
    const gen = ++generation
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<DeckTextureManifest>(`/api/game/${gameCode}/deck-textures`)
      if (gen !== generation) {
        return
      }
      manifest.value = data
      const maxTex = quality.value.maxTex

      if (data.backUrl) {
        try {
          const image = await loadImageElement(data.backUrl)
          const canvas = await resizeToCanvas(image, maxTex, image.naturalWidth || image.width, image.naturalHeight || image.height)
          if (gen === generation) {
            back.value?.dispose()
            back.value = textureFromCanvas(canvas, 4)
          }
        } catch {
          if (gen === generation) {
            back.value?.dispose()
            back.value = textureFromCanvas(createPlaceholderImageBitmap('back', Math.min(256, maxTex)), 4)
          }
        }
      } else if (gen === generation) {
        back.value?.dispose()
        back.value = textureFromCanvas(createPlaceholderImageBitmap('back', Math.min(256, maxTex)), 4)
      }

      // Faces stream in; table can render with placeholders immediately.
      if (gen === generation) {
        loading.value = false
      }

      const priority = new Set(pendingPriority)
      const ordered = [
        ...data.cards.filter(card => priority.has(card.cardCode)),
        ...data.cards.filter(card => !priority.has(card.cardCode)),
      ]

      await loadWithConcurrency(ordered, 6, async (card) => {
        await loadFace(card.cardCode, card.faceUrl, maxTex, gen)
      })
    } catch (err) {
      if (gen === generation) {
        error.value = err instanceof Error ? err.message : 'Texture load failed'
      }
    } finally {
      if (gen === generation) {
        loading.value = false
      }
    }
  }

  function ensurePlaceholder(cardCode: string): THREE.Texture {
    const existing = faces.value.get(cardCode)
    if (existing) {
      return existing
    }
    const canvas = createPlaceholderImageBitmap(cardCode, Math.min(256, quality.value.maxTex))
    const texture = textureFromCanvas(canvas, 4)
    const next = new Map(faces.value)
    next.set(cardCode, texture)
    faces.value = next
    return texture
  }

  function getFace(cardCode: string): THREE.Texture | null {
    return faces.value.get(cardCode) ?? (import.meta.client ? ensurePlaceholder(cardCode) : null)
  }

  function getBack(): THREE.Texture | null {
    if (back.value) {
      return back.value
    }
    if (!import.meta.client) {
      return null
    }
    back.value = textureFromCanvas(
      createPlaceholderImageBitmap('back', Math.min(256, quality.value.maxTex)),
      4,
    )
    return back.value
  }

  watch(
    [codeRef, () => quality.value.maxTex],
    () => {
      void reload()
    },
    { immediate: true },
  )

  onUnmounted(() => {
    disposeAll()
  })

  return {
    manifest,
    loading,
    error,
    faces,
    back,
    getFace,
    getBack,
    prioritize,
    reload,
    disposeAll,
  }
}
