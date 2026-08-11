import type { CardId } from '~~/shared/tarot'

const RANK_LABELS: Record<string, string> = {
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  j: 'V',
  c: 'C',
  q: 'D',
  k: 'R',
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

export type CardFaceColor = 'red' | 'black' | 'gold'

export function tarotCardLabel(cardId: CardId): { shortLabel: string, color: CardFaceColor } {
  if (cardId === 'excuse') {
    return { shortLabel: 'EX', color: 'gold' }
  }

  if (cardId.startsWith('trump-')) {
    return { shortLabel: cardId.replace('trump-', ''), color: 'gold' }
  }

  const dash = cardId.indexOf('-')
  const suit = cardId.slice(0, dash)
  const rank = cardId.slice(dash + 1)
  const symbol = SUIT_SYMBOLS[suit] ?? ''
  const rankLabel = RANK_LABELS[rank] ?? rank.toUpperCase()
  const color: CardFaceColor = suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black'

  return { shortLabel: `${rankLabel}${symbol}`, color }
}
