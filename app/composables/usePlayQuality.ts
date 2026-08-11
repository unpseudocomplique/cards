export type PlayQualityProfile = 'high' | 'medium' | 'low'

export type PlayQualitySettings = {
  profile: PlayQualityProfile
  dprCap: number
  maxTex: number
  shadows: boolean
  lights: 1 | 2
}

const PROFILE_SETTINGS: Record<PlayQualityProfile, Omit<PlayQualitySettings, 'profile'>> = {
  high: { dprCap: 1.5, maxTex: 512, shadows: true, lights: 2 },
  medium: { dprCap: 1.25, maxTex: 384, shadows: false, lights: 1 },
  low: { dprCap: 1.0, maxTex: 256, shadows: false, lights: 1 },
}

export function detectPlayQualityProfile(input: {
  hardwareConcurrency?: number
  maxTouchPoints?: number
  webglRenderer?: string
}): PlayQualityProfile {
  const cores = input.hardwareConcurrency ?? 8
  const renderer = (input.webglRenderer ?? '').toLowerCase()
  const software = /swiftshader|llvmpipe|software/i.test(renderer)
  if (software || cores <= 4) {
    return 'low'
  }
  if (cores <= 6 || (input.maxTouchPoints ?? 0) > 0) {
    return 'medium'
  }
  return 'high'
}

export function settingsForProfile(profile: PlayQualityProfile): PlayQualitySettings {
  return { profile, ...PROFILE_SETTINGS[profile] }
}

export function downgradeProfile(profile: PlayQualityProfile): PlayQualityProfile {
  if (profile === 'high') {
    return 'medium'
  }
  return 'low'
}

export function usePlayQuality() {
  const initial = import.meta.client
    ? detectPlayQualityProfile({
        hardwareConcurrency: navigator.hardwareConcurrency,
        maxTouchPoints: navigator.maxTouchPoints,
      })
    : 'medium'

  const profile = shallowRef<PlayQualityProfile>(initial)
  const settings = computed(() => settingsForProfile(profile.value))
  let lowFpsMs = 0
  let downgraded = false

  function noteFpsSample(fps: number, dtMs: number) {
    if (downgraded || profile.value === 'low') {
      return
    }
    if (fps < 25) {
      lowFpsMs += dtMs
      if (lowFpsMs >= 3000) {
        profile.value = downgradeProfile(profile.value)
        downgraded = true
        lowFpsMs = 0
      }
    } else {
      lowFpsMs = 0
    }
  }

  return {
    profile,
    settings,
    noteFpsSample,
  }
}
