import * as THREE from 'three'
import { salonCharacterById } from '~~/shared/play/salonCharacters'

const FACE_MAX = 256

async function loadResizedTexture(url: string, maxSize: number): Promise<THREE.Texture> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${url}`))
    img.src = url
  })

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const w = Math.max(1, Math.round(image.width * scale))
  const h = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0, w, h)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 2
  texture.needsUpdate = true
  return texture
}

/**
 * Loads AI salon portraits for seat busts (resized). Disposes on unmount.
 * Uses a plain Record — Vue props cannot safely carry Map.
 */
export function useSalonCharacterTextures() {
  const faces = shallowRef<Record<string, THREE.Texture>>({})
  const loading = shallowRef(false)
  const ready = shallowRef(false)
  let disposed = false
  const inflight = new Set<string>()

  async function loadOne(characterId: string): Promise<void> {
    if (disposed || faces.value[characterId] || inflight.has(characterId)) {
      return
    }
    const character = salonCharacterById(characterId)
    if (!character) {
      return
    }
    inflight.add(characterId)
    try {
      const texture = await loadResizedTexture(character.portraitPath, FACE_MAX)
      if (disposed) {
        texture.dispose()
        return
      }
      faces.value = { ...faces.value, [characterId]: texture }
    } catch {
      // optional
    } finally {
      inflight.delete(characterId)
    }
  }

  async function ensureIds(ids: string[]) {
    if (!import.meta.client || disposed) {
      return
    }
    const unique = [...new Set(ids.filter(Boolean))]
    if (!unique.length) {
      ready.value = true
      return
    }
    loading.value = true
    await Promise.all(unique.map(loadOne))
    loading.value = false
    ready.value = true
  }

  function getFace(characterId: string): THREE.Texture | null {
    return faces.value[characterId] ?? null
  }

  function disposeAll() {
    disposed = true
    for (const texture of Object.values(faces.value)) {
      texture.dispose()
    }
    faces.value = {}
  }

  onUnmounted(() => {
    disposeAll()
  })

  return {
    faces,
    loading,
    ready,
    getFace,
    ensureIds,
    disposeAll,
  }
}
