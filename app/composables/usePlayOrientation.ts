import type { MaybeRef } from 'vue'

export function usePlayOrientation(active: MaybeRef<boolean> = true) {
  const isPhonePortrait = useMediaQuery('(orientation: portrait) and (max-width: 768px)')

  function tryLockLandscape() {
    const orientation = globalThis.screen?.orientation as ScreenOrientation & {
      lock?: (type: string) => Promise<void>
    } | undefined

    if (!orientation?.lock) {
      return
    }

    orientation.lock('landscape').catch(() => {})
  }

  function unlockOrientation() {
    try {
      globalThis.screen?.orientation?.unlock?.()
    }
    catch {
      // Some browsers throw if the lock was never granted.
    }
  }

  watch(
    () => toValue(active),
    (isActive) => {
      if (isActive) {
        tryLockLandscape()
      }
      else {
        unlockOrientation()
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    unlockOrientation()
  })

  return {
    isPhonePortrait,
    tryLockLandscape
  }
}
