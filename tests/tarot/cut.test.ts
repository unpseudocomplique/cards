import { describe, expect, it } from 'vitest'
import {
  apply,
  buildTarot78Deck,
  chooseCutIntent,
  createEmptyGame,
  cutDeck,
  cutRange,
  cutterSeat,
  dealFromShuffled,
  gatherPlayedDeal,
  isValidCut,
  shuffleDeck,
  toPublicView
} from '../../shared/tarot'
import type { CardId, GameState } from '../../shared/tarot'

const HOST = 'host'

function cuttingState(deck: CardId[], dealerSeat = 0): GameState {
  const base = createEmptyGame({ hostUserId: HOST, playerCount: 4, endMode: 'threshold', endValue: 1000, deckId: 'd' })
  return {
    ...base,
    phase: 'Cutting',
    dealerSeat,
    currentSeat: cutterSeat(dealerSeat, 4),
    deck,
    deckSource: 'gathered',
    dealIndex: 2,
    seats: base.seats.map((seat, index) => ({ ...seat, userId: `u${index}`, name: `P${index}`, connected: true }))
  }
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

describe('cut', () => {
  it('keeps more than 3 cards on each side (FFT)', () => {
    expect(cutRange()).toEqual({ min: 4, max: 74 })
    expect(isValidCut(3)).toBe(false)
    expect(isValidCut(4)).toBe(true)
    expect(isValidCut(74)).toBe(true)
    expect(isValidCut(75)).toBe(false)
    expect(isValidCut(10.5)).toBe(false)
    expect(isValidCut('20')).toBe(false)
  })

  it('puts the lifted packet under the rest', () => {
    const deck = buildTarot78Deck()
    const cut = cutDeck(deck, 10)
    expect(cut[0]).toBe(deck[10])
    expect(cut.slice(-10)).toEqual(deck.slice(0, 10))
  })

  it('is done by the dealer\'s left neighbour, who plays last', () => {
    expect(cutterSeat(0, 4)).toBe(3)
    expect(cutterSeat(2, 5)).toBe(1)
    expect(cutterSeat(1, 3)).toBe(0)
  })

  it('bots cut somewhere valid, often around the middle', () => {
    const cuts: number[] = []
    for (let i = 0; i < 200; i++) {
      const state = { ...cuttingState(buildTarot78Deck()), rngCounter: i, version: i }
      const intent = chooseCutIntent(state, 3)
      expect(intent.type).toBe('cut')
      if (intent.type === 'cut') {
        expect(isValidCut(intent.at)).toBe(true)
        cuts.push(intent.at)
      }
    }
    expect(new Set(cuts).size).toBeGreaterThan(20)
    const middle = cuts.filter(at => at >= 20 && at <= 58).length
    expect(middle / cuts.length).toBeGreaterThan(0.6)
  })

  it('never shows the order of the pack to the players', () => {
    const view = toPublicView(cuttingState(buildTarot78Deck()))
    expect(view.deckCount).toBe(78)
    expect(JSON.stringify(view)).not.toContain('trump-')
  })

  it('gathers the dog with the camp that owns it', () => {
    const deck = shuffleDeck(buildTarot78Deck(), rng(4))
    const base = cuttingState([])
    const played: GameState = {
      ...base,
      phase: 'Scoring',
      hands: [[], [], [], []],
      chien: deck.slice(0, 6),
      ecart: [],
      pilesAttack: deck.slice(6, 30),
      pilesDefense: deck.slice(30),
      bid: { seat: 0, contract: 'garde_contre' }
    }
    const gathered = gatherPlayedDeal(played)
    expect(gathered).toHaveLength(78)
    expect(new Set(gathered).size).toBe(78)
    // Defence pile on top, its last trick first; the dog at its bottom.
    expect(gathered[0]).toBe(deck[77])
    expect(gathered.slice(48, 54)).toEqual(deck.slice(0, 6).reverse())

    const sans = gatherPlayedDeal({ ...played, bid: { seat: 0, contract: 'garde_sans' } })
    expect(sans.slice(-6)).toEqual(deck.slice(0, 6).reverse())
  })

  it('a petit sec cancels the deal: shuffled again, the next dealer deals after a new cut', () => {
    // Build a pack where, after a cut at 4, seat 1 gets the Petit as its only trump.
    const order = shuffleDeck(buildTarot78Deck(), rng(9))
    const probe = dealFromShuffled(4, order, 1)
    const hand = probe.hands[1]!
    const pack = [...order]
    const swapIn = (card: CardId) => {
      const donor = pack.findIndex(c => !c.startsWith('trump-') && c !== 'excuse' && !hand.includes(c))
      const from = pack.indexOf(card)
      ;[pack[from], pack[donor]] = [pack[donor]!, pack[from]!]
      hand.splice(hand.indexOf(card), 1, pack[from]!)
    }
    for (const card of [...hand]) {
      if ((card.startsWith('trump-') && card !== 'trump-1') || card === 'excuse') {
        swapIn(card)
      }
    }
    if (!hand.includes('trump-1' as CardId)) {
      const plain = hand.find(c => !c.startsWith('trump-'))!
      const from = pack.indexOf(plain)
      const petit = pack.indexOf('trump-1' as CardId)
      ;[pack[from], pack[petit]] = [pack[petit]!, pack[from]!]
    }
    expect(dealFromShuffled(4, pack, 1).petitSecSeats).toEqual([1])

    const deck = [...pack.slice(74), ...pack.slice(0, 74)]
    const state = cuttingState(deck)
    const result = apply(state, { type: 'cut', at: 4 }, { userId: 'u3', seat: 3 })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.events.map(event => event.type)).toEqual(['cut', 'redeal'])
    expect(result.state.phase).toBe('Cutting')
    expect(result.state.redealReason).toBe('petit_sec')
    expect(result.state.deckSource).toBe('shuffled')
    expect(result.state.dealerSeat).toBe(1)
    expect(result.state.currentSeat).toBe(0)
    expect(result.state.dealIndex).toBe(2)
    expect(result.state.deck).toHaveLength(78)
    expect(result.state.deck).not.toEqual(cutDeck(deck, 4))
  })
})
