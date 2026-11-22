/**
 * Full screen at the table: on phones held sideways the first touch hides the
 * browser bars and the system navigation bar (Android). Whoever leaves full
 * screen by hand is not pulled back in until they turn it on again in the
 * settings. iPhones only allow it from the home screen (web app manifest).
 */
export function useTableFullscreen() {
  const active = useState('table-fullscreen-active', () => false)
  const auto = useState('table-fullscreen-auto', () => true)
  const supported = computed(() => import.meta.client && Boolean(
    document.fullscreenEnabled
    || (document as Document & { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled
  ))
  /** iPhone/iPad Safari outside the home-screen app: no full screen for pages. */
  const iosBrowser = computed(() => import.meta.client
    && /iPhone|iPad|iPod/.test(navigator.userAgent)
    && !(navigator as Navigator & { standalone?: boolean }).standalone
    && !window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches)

  function currentElement() {
    const doc = document as Document & { webkitFullscreenElement?: Element | null }
    return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
  }

  async function enter() {
    if (!supported.value || currentElement()) {
      return
    }
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
    try {
      if (root.requestFullscreen) {
        await root.requestFullscreen({ navigationUI: 'hide' })
      } else {
        await root.webkitRequestFullscreen?.()
      }
    } catch {
      // Refused (no user gesture, iframe…): stay as is.
    }
  }

  async function exit() {
    if (!currentElement()) {
      return
    }
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void }
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else {
        await doc.webkitExitFullscreen?.()
      }
    } catch {
      // Already out.
    }
  }

  async function toggle() {
    if (currentElement()) {
      auto.value = false
      await exit()
    } else {
      auto.value = true
      await enter()
    }
  }

  /** Call once from the table page: listens for touches in landscape. */
  function install() {
    if (!import.meta.client) {
      return
    }
    const landscapePhone = window.matchMedia('(orientation: landscape) and (max-height: 520px) and (pointer: coarse)')
    let wasActive = false

    const onChange = () => {
      const now = Boolean(currentElement())
      // Left full screen by hand (back gesture, Esc): respect it.
      if (wasActive && !now) {
        auto.value = false
      }
      wasActive = now
      active.value = now
    }
    const onTouch = () => {
      if (auto.value && landscapePhone.matches && !currentElement()) {
        void enter()
      }
    }
    const onOrientation = () => {
      // Turning back upright: the bars come back on their own.
      if (!landscapePhone.matches && currentElement()) {
        wasActive = false
        void exit()
      }
    }

    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    window.addEventListener('pointerdown', onTouch, { passive: true })
    landscapePhone.addEventListener('change', onOrientation)

    onBeforeUnmount(() => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
      window.removeEventListener('pointerdown', onTouch)
      landscapePhone.removeEventListener('change', onOrientation)
      wasActive = false
      void exit()
    })
  }

  return { active, auto, supported, iosBrowser, enter, exit, toggle, install }
}
