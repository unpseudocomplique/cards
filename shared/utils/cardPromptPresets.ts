export const cardPromptRoleValues = ['number', 'ace', 'jack', 'knight', 'queen', 'king', 'trump', 'excuse'] as const
export const cardPromptSuitValues = ['hearts', 'diamonds', 'clubs', 'spades', 'trumps'] as const

export type CardPromptRole = typeof cardPromptRoleValues[number]
export type CardPromptSuit = typeof cardPromptSuitValues[number]
export type CardRolePrompts = Partial<Record<CardPromptRole, string>>
export type CardSuitPrompts = Partial<Record<CardPromptSuit, string>>

export const defaultRolePrompts: Record<CardPromptRole, string> = {
  ace: 'Composition centrale simple, présence noble et silhouette claire, avec un fond épuré qui laisse respirer la carte.',
  jack: 'Les Valets forment un carré de jeunes officiers, pages ou messagers de cour. Posture active, costume élégant, un seul accessoire maximum, fond architectural discret repoussé au second plan.',
  knight: 'Les Cavaliers forment un carré héroïque et mobile. Tenue de chevalerie ou de voyage, allure dynamique, monture seulement suggérée si elle ne surcharge pas la carte, décor clairement en retrait.',
  queen: 'Les Dames forment un carré royal et élégant. Port noble, bijoux ou couronne discrets, textile raffiné, fond doux et cérémoniel repoussé derrière la silhouette.',
  king: 'Les Rois forment un carré souverain. Posture stable, présence majestueuse, manteau ou couronne visible, fond plus solennel et structuré mais toujours derrière le personnage.',
  trump: 'Les Atouts gardent une composition verticale de tarot, sobre et théâtrale, avec un thème principal lisible et peu d accessoires.',
  excuse: 'L Excuse garde une présence libre, poétique et bienveillante, comme un voyageur ou un fou de tarot, dans une composition simple.',
  number: 'Les cartes numérales restent très sobres: portrait clair, peu d accessoires, arrière-plan simple, focus sur la personne.'
}

export const defaultSuitPrompts: Record<CardPromptSuit, string> = {
  hearts: 'Couleur Coeurs: ambiance chaleureuse, joyeuse et affectueuse. Le regard est doux ou amoureux. Costume avec accents rouges, bordeaux ou rose profond, motifs textiles arrondis et délicats, sans pictogramme de coeur.',
  diamonds: 'Couleur Carreaux: ambiance stricte, précise et noble, mais bienveillante. Costume avec accents rouges, dorés ou ivoire, motifs géométriques fins rappelant le raffinement et la structure, sans losange isolé de carte.',
  clubs: 'Couleur Trèfles: ambiance vivante, confiante et naturelle. Costume avec accents vert sombre, noir ou cuivre, broderies végétales discrètes et énergie terrienne, sans pictogramme de trèfle.',
  spades: 'Couleur Piques: ambiance calme, intense et stratégique. Costume avec accents noirs, bleu nuit ou argentés, lignes plus nettes et attitude concentrée, sans pictogramme de pique.',
  trumps: 'Atouts: ambiance de tarot sobre, verticale et symbolique. Palette harmonisée avec le style global du deck, sans chiffres ni cartouches imprimés dans l illustration.'
}

export function mergeRolePrompts(prompts?: CardRolePrompts | null) {
  return {
    ...defaultRolePrompts,
    ...(prompts || {})
  }
}

export function mergeSuitPrompts(prompts?: CardSuitPrompts | null) {
  return {
    ...defaultSuitPrompts,
    ...(prompts || {})
  }
}
