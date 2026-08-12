import type { DeckTextureManifest } from '~~/shared/tarot/deckTextures'

/**
 * Lightweight face URL map for DOM card UIs (écart, appel roi, etc.).
 * Shares the same `/deck-textures` endpoint as the 3D texture loader.
 */
export function useDeckFaceUrls(code: Ref<string> | string) {
  const codeRef = isRef(code) ? code : ref(code)

  const { data, pending, error, refresh } = useAsyncData(
    `deck-face-urls-${toValue(codeRef)}`,
    async () => {
      const gameCode = codeRef.value
      if (!import.meta.client || !gameCode) {
        return null
      }
      return await $fetch<DeckTextureManifest>(`/api/game/${gameCode}/deck-textures`)
    },
    {
      watch: [codeRef],
      server: false,
      default: () => null,
    },
  )

  const faceUrls = computed(() => {
    const map = new Map<string, string | null>()
    for (const card of data.value?.cards ?? []) {
      map.set(card.cardCode, card.faceUrl)
    }
    return map
  })

  const backUrl = computed(() => data.value?.backUrl ?? null)

  function faceUrlFor(cardCode: string): string | null {
    return faceUrls.value.get(cardCode) ?? null
  }

  return {
    faceUrls,
    backUrl,
    faceUrlFor,
    pending,
    error,
    refresh,
  }
}
