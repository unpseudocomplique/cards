/** Chrome / Edge / Samsung Internet install offer, kept for our own button. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallPlatform = 'ios-safari' | 'ios-other' | 'android' | 'desktop'

const DISMISS_KEY = 'cards-install-dismissed-at'
/** After "Plus tard", the banner stays away this long. */
const DISMISS_DAYS = 21

// The event object cannot live in serialisable state: module scope, client only.
const deferred = shallowRef<BeforeInstallPromptEvent | null>(null)

function readDismissedAt() {
  try {
    return Number(localStorage.getItem(DISMISS_KEY)) || 0
  } catch {
    return 0
  }
}

/**
 * Everything about installing Cards on the home screen: which instructions
 * fit this device, whether it is already installed, and the native prompt
 * when the browser offers one.
 */
export function useInstallApp() {
  const sheetOpen = useState('install-sheet-open', () => false)
  const installedNow = useState('install-installed-now', () => false)
  const dismissedAt = useState('install-dismissed-at', () => 0)
  const ready = useState('install-ready', () => false)

  const platform = computed<InstallPlatform>(() => {
    if (!import.meta.client) {
      return 'desktop'
    }
    const ua = navigator.userAgent
    // iPadOS reports itself as a Mac: tell it apart by touch.
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    if (ios) {
      return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? 'ios-other' : 'ios-safari'
    }
    if (/Android/.test(ua)) {
      return 'android'
    }
    return 'desktop'
  })

  /** Opened from the home-screen icon (any platform). */
  const standalone = computed(() => import.meta.client && (
    installedNow.value
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    || window.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches
  ))

  const isPhoneOrTablet = computed(() => platform.value !== 'desktop'
    || (import.meta.client && window.matchMedia('(pointer: coarse)').matches))

  const canPrompt = computed(() => Boolean(deferred.value))

  /** Our own invitation: phones/tablets only, not installed, not recently dismissed. */
  const shouldInvite = computed(() => ready.value
    && !standalone.value
    && isPhoneOrTablet.value
    && Date.now() - dismissedAt.value > DISMISS_DAYS * 86_400_000)

  if (import.meta.client && !ready.value) {
    dismissedAt.value = readDismissedAt()
    ready.value = true
  }

  function setDeferredPrompt(event: BeforeInstallPromptEvent) {
    deferred.value = event
  }

  function markInstalled() {
    deferred.value = null
    installedNow.value = true
    sheetOpen.value = false
  }

  function dismiss() {
    dismissedAt.value = Date.now()
    try {
      localStorage.setItem(DISMISS_KEY, String(dismissedAt.value))
    } catch {
      // Private mode: it comes back next visit, no harm.
    }
  }

  /**
   * Install button: the browser's own dialog when it offers one, otherwise
   * our step-by-step sheet (always the case on iPhone).
   */
  async function install() {
    const event = deferred.value
    if (!event) {
      sheetOpen.value = true
      return
    }
    deferred.value = null
    try {
      await event.prompt()
      const choice = await event.userChoice
      if (choice.outcome === 'accepted') {
        markInstalled()
      }
    } catch {
      sheetOpen.value = true
    }
  }

  return {
    platform,
    standalone,
    canPrompt,
    shouldInvite,
    sheetOpen,
    install,
    dismiss,
    setDeferredPrompt,
    markInstalled
  }
}
