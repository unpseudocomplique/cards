import type { BeforeInstallPromptEvent } from '~/composables/useInstallApp'
import { trackSafeArea } from '~/utils/safeArea'

/**
 * Home-screen app: registers the service worker (production only) and keeps
 * the browser's install offer (Android / desktop Chrome) for our own button.
 * Must run early: `beforeinstallprompt` fires once, soon after load.
 */
export default defineNuxtPlugin(() => {
  const install = useInstallApp()
  trackSafeArea()

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    install.setDeferredPrompt(event as BeforeInstallPromptEvent)
  })
  window.addEventListener('appinstalled', () => {
    install.markInstalled()
  })

  if (!import.meta.dev && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // No service worker (private mode, old browser): the site works the same.
      })
    }, { once: true })
  }
})
