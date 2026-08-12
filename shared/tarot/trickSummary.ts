import { boutLabel, isBout, isPetitStolen } from './camps'
import { resolveTrick, trickLedSuit, trumpValue } from './trick'
import type { CardId, PublicGameView } from './types'

const SUIT_FR: Record<string, string> = {
  hearts: 'cœur',
  diamonds: 'carreau',
  clubs: 'trèfle',
  spades: 'pique',
}

const RANK_FR: Record<string, string> = {
  k: 'Roi',
  q: 'Dame',
  c: 'Cavalier',
  j: 'Valet',
  '1': 'As',
  '10': '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
}

export function cardLabelFr(card: CardId): string {
  if (card === 'excuse') {
    return "l'Excuse"
  }
  if (card.startsWith('trump-')) {
    const value = card.slice('trump-'.length)
    if (value === '1') {
      return 'le Petit'
    }
    if (value === '21') {
      return 'le 21'
    }
    return `l'atout ${value}`
  }
  const dash = card.lastIndexOf('-')
  const suit = card.slice(0, dash)
  const rank = card.slice(dash + 1)
  const suitFr = SUIT_FR[suit] ?? suit
  const rankFr = RANK_FR[rank] ?? rank
  return `${rankFr} de ${suitFr}`
}

export type TrickSummary = {
  title: string
  subtitle: string
  details: string[]
  winnerSeat: number
  winningCard: CardId
  accent: 'gold' | 'rose' | 'slate'
}

type SeatNamed = { seats: Array<{ name: string | null } | null> }

function seatLabel(state: SeatNamed, seat: number): string {
  return state.seats[seat]?.name ?? `Joueur ${seat + 1}`
}

/**
 * Human-readable explanation of a finished trick for the play table HUD.
 */
export function describeTrick(
  state: Pick<PublicGameView, 'playerCount' | 'bid' | 'partnerSeat' | 'seats'>,
  trick: Array<{ seat: number, card: CardId }>,
): TrickSummary {
  const { winnerSeat } = resolveTrick(trick)
  const winningEntry = trick.find(entry => entry.seat === winnerSeat)!
  const winningCard = winningEntry.card
  const winnerName = seatLabel(state, winnerSeat)
  const ledSuit = trickLedSuit(trick)
  const details: string[] = []

  const steal = isPetitStolen(state, trick, winnerSeat)
  if (steal.stolen) {
    details.push(
      `${seatLabel(state, steal.thiefSeat)} vole le Petit de ${seatLabel(state, steal.victimSeat)}`,
    )
  }

  const excusePlay = trick.find(entry => entry.card === 'excuse')
  if (excusePlay) {
    details.push(`${seatLabel(state, excusePlay.seat)} pose l'Excuse`)
  }

  for (const entry of trick) {
    if (entry.card === 'trump-21') {
      details.push(`${seatLabel(state, entry.seat)} sort le 21`)
    }
  }

  let how = `avec ${cardLabelFr(winningCard)}`
  if (ledSuit === 'trumps') {
    how = `plus fort à l'atout (${cardLabelFr(winningCard)})`
  }
  else if (trumpValue(winningCard) != null) {
    how = `coupe avec ${cardLabelFr(winningCard)}`
  }
  else if (ledSuit) {
    how = `plus fort en ${SUIT_FR[ledSuit] ?? ledSuit} (${cardLabelFr(winningCard)})`
  }

  const bout = boutLabel(winningCard)
  if (bout && isBout(winningCard) && winningCard !== 'excuse') {
    details.unshift(`Remporté grâce à ${bout}`)
  }

  const accent = steal.stolen ? 'rose' : details.some(d => d.includes('21') || d.includes('Excuse') || d.includes('Petit')) ? 'gold' : 'slate'

  return {
    title: `Pli pour ${winnerName}`,
    subtitle: how,
    details,
    winnerSeat,
    winningCard,
    accent,
  }
}
