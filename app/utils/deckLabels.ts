import type { CardRolePromptKey, CardSuitPromptKey, DeckCard, DeckSummary, DeckType } from '~/types/deck'

type BadgeColor = 'neutral' | 'info' | 'warning' | 'success' | 'error' | 'primary'

export const deckTypeOptions: Array<{ value: DeckType, label: string, short: string, description: string, cards: number }> = [
  {
    value: 'tarot78',
    label: 'Tarot complet',
    short: 'Tarot 78',
    description: 'Les 56 cartes d’enseignes, les 21 atouts et l’Excuse. Le seul format jouable en ligne.',
    cards: 78
  },
  {
    value: 'tarot56',
    label: 'Tarot enseignes',
    short: 'Tarot 56',
    description: 'Quatre enseignes avec Valets, Cavaliers, Dames et Rois, sans les atouts.',
    cards: 56
  },
  {
    value: 'classic52',
    label: 'Jeu classique',
    short: 'Classique 52',
    description: 'As, valeurs, Valets, Dames et Rois sur quatre enseignes.',
    cards: 52
  }
]

export const deckTypeLabels = Object.fromEntries(
  deckTypeOptions.map(option => [option.value, option.short])
) as Record<DeckType, string>

export const deckStatusMeta: Record<DeckSummary['status'], { label: string, color: BadgeColor }> = {
  draft: { label: 'En préparation', color: 'neutral' },
  queued: { label: 'En file', color: 'info' },
  generating: { label: 'Génération', color: 'warning' },
  ready: { label: 'Terminé', color: 'success' },
  failed: { label: 'À reprendre', color: 'error' }
}

export const cardStatusMeta: Record<DeckCard['status'], { label: string, color: BadgeColor, icon: string }> = {
  pending: { label: 'À générer', color: 'neutral', icon: 'i-lucide-circle-dashed' },
  queued: { label: 'En file', color: 'info', icon: 'i-lucide-clock' },
  generating: { label: 'En cours', color: 'warning', icon: 'i-lucide-loader-circle' },
  ready: { label: 'Prête', color: 'success', icon: 'i-lucide-circle-check' },
  failed: { label: 'Échec', color: 'error', icon: 'i-lucide-circle-alert' }
}

export const roleMeta: Record<CardRolePromptKey, { singular: string, plural: string, order: number }> = {
  king: { singular: 'Roi', plural: 'Rois', order: 0 },
  queen: { singular: 'Dame', plural: 'Dames', order: 1 },
  knight: { singular: 'Cavalier', plural: 'Cavaliers', order: 2 },
  jack: { singular: 'Valet', plural: 'Valets', order: 3 },
  trump: { singular: 'Atout', plural: 'Atouts', order: 4 },
  excuse: { singular: 'Excuse', plural: 'Excuse', order: 5 },
  ace: { singular: 'As', plural: 'As', order: 6 },
  number: { singular: 'Numérale', plural: 'Numérales', order: 7 }
}

export const suitMeta: Record<CardSuitPromptKey, { label: string, symbol: string, red: boolean }> = {
  hearts: { label: 'Cœurs', symbol: '♥', red: true },
  diamonds: { label: 'Carreaux', symbol: '♦', red: true },
  clubs: { label: 'Trèfles', symbol: '♣', red: false },
  spades: { label: 'Piques', symbol: '♠', red: false },
  trumps: { label: 'Atouts', symbol: '★', red: false }
}

export const faceRoles: CardRolePromptKey[] = ['king', 'queen', 'knight', 'jack']

export function cardRole(card: DeckCard) {
  return (card.metadata.role || 'number') as CardRolePromptKey
}

export function cardSuit(card: DeckCard) {
  return (card.metadata.suit || null) as CardSuitPromptKey | null
}

export function cardSubtitle(card: DeckCard) {
  const role = roleMeta[cardRole(card)]?.singular ?? 'Carte'
  const suit = cardSuit(card)

  if (!suit || suit === 'trumps') {
    return role
  }

  return `${role} · ${suitMeta[suit].label}`
}

/** Cards that still need an image and can be generated (a person is assigned). */
export function isGeneratable(card: DeckCard) {
  return Boolean(card.sourcePersonId) && card.status !== 'ready' && card.status !== 'generating'
}
