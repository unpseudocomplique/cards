import { AMBIANCE_THEMES } from '~/utils/ambianceThemes'
import type { AmbianceThemeId } from '~/utils/ambianceThemes'

const STORAGE_KEY = 'cards:play-ambiance'

function isThemeId(value: unknown): value is AmbianceThemeId {
  return typeof value === 'string' && value in AMBIANCE_THEMES
}

/** Room mood of the play table, chosen by each player and kept on their device. */
export function usePlayAmbiance() {
  const themeId = useState<AmbianceThemeId>('play-ambiance', () => 'nuit')
  const loaded = useState('play-ambiance-loaded', () => false)

  if (import.meta.client && !loaded.value) {
    loaded.value = true
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (isThemeId(saved)) {
        themeId.value = saved
      }
    } catch {
      // Private mode or blocked storage: keep the default.
    }
  }

  function setTheme(id: AmbianceThemeId) {
    themeId.value = id
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Not saved; still applied for this visit.
    }
  }

  return { themeId, setTheme }
}
