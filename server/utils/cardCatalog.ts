export type DeckType = 'classic52' | 'tarot56' | 'tarot78'
export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'trumps'
export type CardRole = 'number' | 'ace' | 'jack' | 'knight' | 'queen' | 'king' | 'trump' | 'excuse'

export type CardDefinition = {
  cardCode: string
  suit?: CardSuit
  rank?: string
  role: CardRole
  label: string
  shortLabel: string
  sortOrder: number
  aspectRatio: '3:4' | '9:16'
  promptHint: string
}

const suits: Array<{ id: Exclude<CardSuit, 'trumps'>, label: string, symbol: string }> = [
  { id: 'hearts', label: 'Coeurs', symbol: '♥' },
  { id: 'diamonds', label: 'Carreaux', symbol: '♦' },
  { id: 'clubs', label: 'Trèfles', symbol: '♣' },
  { id: 'spades', label: 'Piques', symbol: '♠' }
]

const classicRanks: Array<{ rank: string, label: string, shortLabel: string, role: CardRole }> = [
  { rank: 'A', label: 'As', shortLabel: 'A', role: 'ace' },
  ...Array.from({ length: 9 }, (_, index) => {
    const rank = String(index + 2)
    return { rank, label: rank, shortLabel: rank, role: 'number' as const }
  }),
  { rank: 'J', label: 'Valet', shortLabel: 'V', role: 'jack' },
  { rank: 'Q', label: 'Dame', shortLabel: 'D', role: 'queen' },
  { rank: 'K', label: 'Roi', shortLabel: 'R', role: 'king' }
]

const tarotRanks: Array<{ rank: string, label: string, shortLabel: string, role: CardRole }> = [
  ...Array.from({ length: 10 }, (_, index) => {
    const rank = String(index + 1)
    return { rank, label: rank, shortLabel: rank, role: 'number' as const }
  }),
  { rank: 'J', label: 'Valet', shortLabel: 'V', role: 'jack' },
  { rank: 'C', label: 'Cavalier', shortLabel: 'C', role: 'knight' },
  { rank: 'Q', label: 'Dame', shortLabel: 'D', role: 'queen' },
  { rank: 'K', label: 'Roi', shortLabel: 'R', role: 'king' }
]

const rolePromptHints: Record<CardRole, string> = {
  number: 'portrait décoratif intégré dans une carte numérale élégante',
  ace: 'figure centrale noble et symbolique pour un as',
  jack: 'valet de cour expressif, costume raffiné, posture dynamique',
  knight: 'cavalier de tarot, allure héroïque, monture suggérée, tenue cérémonielle',
  queen: 'dame royale, présence élégante, bijoux et textile riche',
  king: 'roi majestueux, posture souveraine, couronne et manteau stylisés',
  trump: 'arcane majeur de tarot, composition verticale symbolique et théâtrale',
  excuse: 'l Excuse de tarot, personnage libre et poétique, atmosphère de voyage'
}

function buildSuitCards(ranks: typeof classicRanks, startOrder: number): CardDefinition[] {
  return suits.flatMap((suit, suitIndex) => ranks.map((rank, rankIndex) => ({
    cardCode: `${suit.id}-${rank.rank.toLowerCase()}`,
    suit: suit.id,
    rank: rank.rank,
    role: rank.role,
    label: `${rank.label} de ${suit.label}`,
    shortLabel: `${rank.shortLabel}${suit.symbol}`,
    sortOrder: startOrder + suitIndex * ranks.length + rankIndex,
    aspectRatio: '3:4',
    promptHint: rolePromptHints[rank.role]
  })))
}

function buildTrumpCards(startOrder: number): CardDefinition[] {
  const trumps = Array.from({ length: 21 }, (_, index) => {
    const number = index + 1

    return {
      cardCode: `trump-${number}`,
      suit: 'trumps' as const,
      rank: String(number),
      role: 'trump' as const,
      label: `Atout ${number}`,
      shortLabel: String(number),
      sortOrder: startOrder + index,
      aspectRatio: '9:16' as const,
      promptHint: rolePromptHints.trump
    }
  })

  return [
    ...trumps,
    {
      cardCode: 'excuse',
      suit: 'trumps',
      role: 'excuse',
      label: 'Excuse',
      shortLabel: 'EX',
      sortOrder: startOrder + 21,
      aspectRatio: '9:16',
      promptHint: rolePromptHints.excuse
    }
  ]
}

export function getCardCatalog(type: DeckType): CardDefinition[] {
  if (type === 'classic52') {
    return buildSuitCards(classicRanks, 0)
  }

  const minorArcana = buildSuitCards(tarotRanks, 0)

  if (type === 'tarot56') {
    return minorArcana
  }

  return [
    ...minorArcana,
    ...buildTrumpCards(minorArcana.length)
  ]
}

export const deckTypeLabels: Record<DeckType, string> = {
  classic52: 'Jeu classique 52 cartes',
  tarot56: 'Tarot enseignes 56 cartes',
  tarot78: 'Tarot complet 78 cartes'
}
