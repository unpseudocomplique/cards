/** Table moods: the cloth and the wood of the play table, chosen in the table settings. */
export type AmbianceThemeId = 'actuel' | 'nuit' | 'club' | 'bistrot'

export type AmbianceTheme = {
  /** Cloth colour, and its darker edge. */
  felt: string
  feltEdge: string
  /** Warm light pooled in the middle of the cloth. */
  glow: string
  /** Wood showing in the corners, light then dark. */
  wood: string
  woodDark: string
}

export const AMBIANCE_THEMES: Record<AmbianceThemeId, AmbianceTheme> = {
  nuit: {
    felt: '#2c5a3c',
    feltEdge: '#16301f',
    glow: 'rgba(255, 228, 160, 0.16)',
    wood: '#5a3520',
    woodDark: '#24140c'
  },
  club: {
    felt: '#1d4a43',
    feltEdge: '#0d2622',
    glow: 'rgba(220, 240, 210, 0.12)',
    wood: '#5a2216',
    woodDark: '#200b06'
  },
  bistrot: {
    felt: '#6a1e2a',
    feltEdge: '#360d14',
    glow: 'rgba(255, 210, 150, 0.14)',
    wood: '#7a5230',
    woodDark: '#2e1c0e'
  },
  actuel: {
    felt: '#24456b',
    feltEdge: '#10213a',
    glow: 'rgba(210, 225, 255, 0.14)',
    wood: '#6b5a48',
    woodDark: '#2a2219'
  }
}

/** Shown in the table settings, in this order. */
export const AMBIANCE_CHOICES: Array<{ id: AmbianceThemeId, label: string, hint: string }> = [
  { id: 'nuit', label: 'Salon de nuit', hint: 'Tapis vert, noyer' },
  { id: 'club', label: 'Cercle de jeu', hint: 'Vert anglais, acajou' },
  { id: 'bistrot', label: 'Bistrot parisien', hint: 'Tapis bordeaux, chêne' },
  { id: 'actuel', label: 'Bord de mer', hint: 'Tapis bleu nuit, bois flotté' }
]

export function ambianceTheme(id: string | null | undefined): AmbianceTheme {
  return AMBIANCE_THEMES[(id ?? 'nuit') as AmbianceThemeId] ?? AMBIANCE_THEMES.nuit
}
