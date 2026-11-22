/** Room moods for the play table (prototype, chosen by ?amb=). */
export type AmbianceThemeId = 'actuel' | 'nuit' | 'club' | 'bistrot'

export type AmbianceTheme = {
  wall: { base: string, line: string }
  backdrop: 'curtain' | 'books' | 'window'
  curtain: [string, string]
  wood: string
  felt: string
  feltCenter: string
  feltCenterOpacity: number
  lights: {
    hemi: number
    ambient: number
    key: number
    keyColor: string
    fill: number
    /** Warm cone over the table; 0 = none. */
    spot: number
    spotColor: string
    /** Light washing the back wall so the backdrop reads. */
    wall: number
  }
  /** Darkening of the screen edges (0..1), drawn in DOM over the canvas. */
  vignette: number
  /** Coloured haze on top of the vignette (CSS colour). */
  haze?: string
}

export const AMBIANCE_THEMES: Record<AmbianceThemeId, AmbianceTheme> = {
  actuel: {
    wall: { base: '#3d2a20', line: 'rgba(120, 80, 50, 0.25)' },
    backdrop: 'curtain',
    curtain: ['#4a1420', '#8a2434'],
    wood: '#6b4228',
    felt: '#2f5c3f',
    feltCenter: '#0f2418',
    feltCenterOpacity: 0.4,
    lights: { hemi: 0.7, ambient: 0.62, key: 1.45, keyColor: '#ffe2b8', fill: 0.55, spot: 0, spotColor: '#ffd9a0', wall: 0 },
    vignette: 0,
  },
  nuit: {
    wall: { base: '#2a1a14', line: 'rgba(160, 110, 60, 0.22)' },
    backdrop: 'curtain',
    curtain: ['#2a0a12', '#5e1624'],
    wood: '#5a3420',
    felt: '#2c5a3c',
    feltCenter: '#f6d58a',
    feltCenterOpacity: 0.07,
    lights: { hemi: 0.28, ambient: 0.18, key: 0.55, keyColor: '#ffd9a8', fill: 0.15, spot: 16, spotColor: '#ffd49a', wall: 2.2 },
    vignette: 0.75,
    haze: 'rgba(255, 170, 80, 0.06)',
  },
  club: {
    wall: { base: '#14261c', line: 'rgba(200, 170, 90, 0.16)' },
    backdrop: 'books',
    curtain: ['#1c120c', '#2c1c12'],
    wood: '#3a1e12',
    felt: '#1f4a34',
    feltCenter: '#e8f0c0',
    feltCenterOpacity: 0.06,
    lights: { hemi: 0.3, ambient: 0.2, key: 0.6, keyColor: '#fff0d0', fill: 0.15, spot: 15, spotColor: '#fff2cf', wall: 2.6 },
    vignette: 0.65,
    haze: 'rgba(80, 140, 90, 0.07)',
  },
  bistrot: {
    wall: { base: '#5a3e24', line: 'rgba(240, 200, 140, 0.18)' },
    backdrop: 'window',
    curtain: ['#0c1424', '#1c2c48'],
    wood: '#8a5a30',
    felt: '#6a1e26',
    feltCenter: '#ffd9a0',
    feltCenterOpacity: 0.08,
    lights: { hemi: 0.45, ambient: 0.3, key: 0.8, keyColor: '#ffcf90', fill: 0.3, spot: 11, spotColor: '#ffc880', wall: 3 },
    vignette: 0.5,
    haze: 'rgba(255, 150, 60, 0.08)',
  },
}

export function ambianceTheme(id: string | null | undefined): AmbianceTheme {
  return AMBIANCE_THEMES[(id ?? 'actuel') as AmbianceThemeId] ?? AMBIANCE_THEMES.actuel
}
