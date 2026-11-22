/**
 * Screen edges hidden by the notch / Dynamic Island and the home bar
 * (env(safe-area-inset-*) in px). Phones held sideways lose ~50 px on each
 * side: the table keeps portraits and the hand out of there. Stays at 0 on
 * the server, on desktop and in tests.
 *
 * Plain object on purpose (no Vue import, so layout tests run as is): insets
 * only change with the window size, and the resize listener below is added
 * before any table component's, so their size-based computeds re-run after it.
 */
export const safeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 }

let probe: HTMLElement | null = null

function measure() {
  if (!probe) {
    return
  }
  const style = getComputedStyle(probe)
  safeAreaInsets.top = Number.parseFloat(style.paddingTop) || 0
  safeAreaInsets.right = Number.parseFloat(style.paddingRight) || 0
  safeAreaInsets.bottom = Number.parseFloat(style.paddingBottom) || 0
  safeAreaInsets.left = Number.parseFloat(style.paddingLeft) || 0
}

/** Starts tracking the insets (once, client side). */
export function trackSafeArea() {
  if (typeof window === 'undefined' || probe) {
    return
  }
  probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;z-index:-1;'
    + 'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);'
  document.body.appendChild(probe)
  measure()
  window.addEventListener('resize', measure, { passive: true })
}
