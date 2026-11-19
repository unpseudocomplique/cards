/**
 * End-to-end real-time checks for a table with several human players.
 *
 * Drives the real WebSocket handler (server/routes/game/ws.ts) and GameStore
 * with simulated browser clients, then checks that every client stays in sync
 * and only ever receives what its player is allowed to see.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { chooseBotIntent } from '../../shared/tarot'
import type { CardId, Contract, GameState, Intent, PrivateGameView } from '../../shared/tarot'
import type { gameStore as GameStoreInstance } from '../../server/game/GameStore'

type Handler = {
  open: (peer: FakePeer) => Promise<void>
  message: (peer: FakePeer, message: string) => void
  close: (peer: FakePeer) => void
}

type FakePeer = {
  userId: string
  request: { url: string }
  closed: { code: number, reason: string } | null
  send: (data: string) => void
  close: (code: number, reason: string) => void
}

type ServerMessage
  = | { type: 'private', private: PrivateGameView }
    | { type: 'error', error: string, reason?: string }
    | { type: 'applied', publicVersion: number }

let handler: Handler
let gameStore: typeof GameStoreInstance

beforeAll(async () => {
  vi.stubGlobal('defineWebSocketHandler', (h: Handler) => h)
  vi.stubGlobal('requireUserSession', async (target: { userId?: string }) => {
    if (!target?.userId) {
      throw new Error('Unauthorized')
    }
    return { user: { id: target.userId } }
  })
  handler = (await import('../../server/routes/game/ws')).default as unknown as Handler
  gameStore = (await import('../../server/game/GameStore')).gameStore
})

const CARD_RE = /^(?:(?:hearts|diamonds|clubs|spades)-(?:[1-9]|10|j|c|q|k)|trump-(?:[1-9]|1\d|2[01])|excuse)$/

function collectCards(value: unknown, into: Set<string>): Set<string> {
  if (typeof value === 'string') {
    if (CARD_RE.test(value)) {
      into.add(value)
    }
  } else if (Array.isArray(value)) {
    value.forEach(item => collectCards(item, into))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(item => collectCards(item, into))
  }
  return into
}

class Client {
  readonly userId: string
  peer!: FakePeer
  view: PrivateGameView | null = null
  errors: Array<{ error: string, reason?: string }> = []
  messages: ServerMessage[] = []
  /** Every card id this player has legitimately been allowed to see so far. */
  leaks: string[] = []

  constructor(userId: string, readonly code: string) {
    this.userId = userId
  }

  async connect(): Promise<FakePeer> {
    const peer: FakePeer = {
      userId: this.userId,
      request: { url: `http://localhost/game/ws?code=${this.code}` },
      closed: null,
      send: (data) => {
        if (this.peer !== peer) {
          // A stale socket still receiving updates is fine; just don't track it.
          return
        }
        const message = JSON.parse(data) as ServerMessage
        this.messages.push(message)
        if (message.type === 'private') {
          this.checkPrivacy(message.private)
          this.view = message.private
        } else if (message.type === 'error') {
          this.errors.push({ error: message.error, reason: message.reason })
        }
      },
      close: (code, reason) => {
        peer.closed = { code, reason }
      }
    }
    this.peer = peer
    await handler.open(peer)
    return peer
  }

  hello(): void {
    handler.message(this.peer, JSON.stringify({ type: 'hello' }))
  }

  intent(intent: Intent): void {
    handler.message(this.peer, JSON.stringify({ type: 'intent', intent }))
  }

  disconnect(peer: FakePeer = this.peer): void {
    handler.close(peer)
  }

  /** Cards this player may know: own hand + whatever is face up for everyone. */
  private checkPrivacy(view: PrivateGameView): void {
    const allowed = new Set<string>([
      ...view.hand,
      ...view.trick.map(entry => entry.card),
      ...(view.lastTrick ?? []).map(entry => entry.card),
      ...(view.chienRevealed ?? []),
      ...(view.legalMoves ?? []),
      ...(view.calledKing ? [view.calledKing] : [])
    ])
    for (const card of collectCards(view, new Set())) {
      if (!allowed.has(card)) {
        this.leaks.push(card)
      }
    }
  }
}

function serverState(code: string): GameState {
  return gameStore.get(code)!
}

async function seatHumans(count: 3 | 4 | 5, humans: number): Promise<{ code: string, clients: Client[] }> {
  const hostId = 'human-0'
  const { code } = gameStore.createTable({
    hostUserId: hostId,
    hostName: 'Hôte',
    playerCount: count,
    endMode: 'deals',
    endValue: 2,
    deckId: 'deck-test'
  })
  const clients: Client[] = []
  for (let i = 0; i < humans; i++) {
    const client = new Client(`human-${i}`, code)
    await client.connect()
    client.hello()
    if (i > 0) {
      client.intent({ type: 'join', name: `Joueur ${i}` })
    }
    clients.push(client)
  }
  const host = clients[0]!
  for (let i = humans; i < count; i++) {
    host.intent({ type: 'addBot' })
  }
  // Guests say hello before joining and get NOT_SEATED, which the app ignores.
  for (const client of clients) {
    client.errors = []
  }
  return { code, clients }
}

function clientForSeat(clients: Client[], state: GameState, seat: number): Client | undefined {
  const userId = state.seats[seat]?.userId
  return clients.find(client => client.userId === userId)
}

/** Who must act now, from the server's point of view. */
function actingSeat(state: GameState): number {
  if (
    state.playerCount === 5
    && state.bid
    && !state.calledKing
    && (state.phase === 'DogEcarta' || state.phase === 'ReadyToPlay')
  ) {
    return state.bid.seat
  }
  return state.currentSeat
}

type Strategy = {
  bid?: (seat: number, state: GameState) => Contract | 'passe' | undefined
}

/**
 * One human action: the client whose turn it is plays what a bot would.
 * Returns false when it is a bot's turn (caller advances timers instead).
 */
function humanStep(code: string, clients: Client[], strategy: Strategy = {}): boolean {
  const state = serverState(code)
  if (state.phase === 'Scoring') {
    clients[0]!.intent({ type: 'continue' })
    return true
  }
  const seat = actingSeat(state)
  const seatInfo = state.seats[seat]!
  if (seatInfo.controlledBy === 'bot') {
    return false
  }
  const client = clientForSeat(clients, state, seat)!
  let intent: Intent = chooseBotIntent(state, seat)
  if (state.phase === 'Bidding' && strategy.bid) {
    const bid = strategy.bid(seat, state)
    if (bid) {
      intent = { type: 'bid', bid }
    }
  }
  client.intent(intent)
  return true
}

function expectInSync(code: string, clients: Client[]): void {
  const state = serverState(code)
  for (const client of clients) {
    if (client.peer.closed || !client.view) {
      continue
    }
    const seat = state.seats.findIndex(s => s.userId === client.userId)
    expect(client.view.version, `${client.userId} version`).toBe(state.version)
    expect(client.view.seat).toBe(seat)
    expect([...client.view.hand].sort()).toEqual([...state.hands[seat]!].sort())
    expect(client.view.phase).toBe(state.phase)
    expect(client.view.currentSeat).toBe(state.currentSeat)
    expect(client.view.trick).toEqual(state.trick)
    expect(client.view.scores).toEqual(state.scores)
  }
}

function expectNoLeaks(clients: Client[]): void {
  for (const client of clients) {
    expect(client.leaks, `${client.userId} saw cards that are not theirs`).toEqual([])
  }
}

function kingPlayed(state: GameState): boolean {
  const king = state.calledKing
  if (!king) {
    return false
  }
  return state.trick.some(entry => entry.card === king)
    || state.pilesAttack.includes(king)
    || state.pilesDefense.includes(king)
}

describe('real-time multiplayer table', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    gameStore.resetForTests()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    gameStore.resetForTests()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('seats every human and pushes the lobby to all of them', async () => {
    const { code, clients } = await seatHumans(4, 4)
    const state = serverState(code)
    expect(state.seats.map(seat => seat.userId)).toEqual(['human-0', 'human-1', 'human-2', 'human-3'])
    expect(state.seats.every(seat => seat.connected && seat.controlledBy === 'human')).toBe(true)
    expectInSync(code, clients)
    for (const client of clients) {
      expect(client.errors).toEqual([])
    }
  })

  it('a guest cannot start the game or add bots', async () => {
    const { code, clients } = await seatHumans(4, 2)
    clients[1]!.intent({ type: 'start' })
    expect(clients[1]!.errors.at(-1)?.error).toBe('UNAUTHORIZED')
    clients[1]!.intent({ type: 'addBot' })
    expect(clients[1]!.errors.at(-1)?.error).toBe('UNAUTHORIZED')
    expect(serverState(code).phase).toBe('Lobby')
  })

  for (const playerCount of [3, 4, 5] as const) {
    it(`plays a full ${playerCount}-human match in sync without leaking cards`, async () => {
      const { code, clients } = await seatHumans(playerCount, playerCount)
      clients[0]!.intent({ type: 'start' })
      expectInSync(code, clients)

      let steps = 0
      let dealsScored = 0
      while (serverState(code).phase !== 'MatchOver' && steps < 2_000) {
        const before = serverState(code)
        if (before.phase === 'Scoring') {
          dealsScored++
          const sum = Object.values(before.lastDeltas ?? {}).reduce((a, b) => a + b, 0)
          expect(Math.abs(sum)).toBeLessThan(1e-9)
        }
        // Nobody may know the secret partner before the called king shows up.
        if (before.playerCount === 5 && before.calledKing && !kingPlayed(before) && before.phase !== 'Scoring') {
          for (const client of clients) {
            expect(client.view?.partnerSeat, `${client.userId} knows the partner too early`).toBeUndefined()
          }
        }
        expect(humanStep(code, clients)).toBe(true)
        expectInSync(code, clients)
        steps++
      }
      expect(serverState(code).phase).toBe('MatchOver')
      expect(dealsScored).toBeGreaterThanOrEqual(1)
      expectNoLeaks(clients)
      for (const client of clients) {
        expect(client.errors).toEqual([])
      }
    })
  }

  it('plays a full match with 2 humans and 3 bots, bots driven by the server timers', async () => {
    const { code, clients } = await seatHumans(5, 2)
    clients[0]!.intent({ type: 'start' })
    let guard = 0
    while (serverState(code).phase !== 'MatchOver' && guard < 3_000) {
      if (!humanStep(code, clients)) {
        vi.advanceTimersByTime(6_000)
      }
      expectInSync(code, clients)
      guard++
    }
    expect(serverState(code).phase).toBe('MatchOver')
    expectNoLeaks(clients)
    for (const client of clients) {
      expect(client.errors).toEqual([])
    }
  })

  it('two tables do not get the same deal', async () => {
    const first = await seatHumans(4, 4)
    first.clients[0]!.intent({ type: 'start' })
    const second = await seatHumans(4, 4)
    second.clients[0]!.intent({ type: 'start' })
    expect(serverState(first.code).hands).not.toEqual(serverState(second.code).hands)
  })

  it('5 players: only the called partner can tell, everybody learns when the king is played', async () => {
    const { code, clients } = await seatHumans(5, 5)
    clients[0]!.intent({ type: 'start' })

    let checkedBeforeReveal = false
    let checkedAfterReveal = false
    let steps = 0
    while (steps < 400 && serverState(code).phase !== 'Scoring') {
      const state = serverState(code)
      if (state.calledKing && state.partnerSeat !== undefined) {
        const partner = state.partnerSeat
        if (!kingPlayed(state)) {
          for (const client of clients) {
            const holdsKing = client.view!.hand.includes(state.calledKing)
            expect(holdsKing).toBe(client.view!.seat === partner)
            expect(client.view!.partnerSeat).toBeUndefined()
          }
          checkedBeforeReveal = true
        } else {
          for (const client of clients) {
            expect(client.view!.partnerSeat).toBe(partner)
          }
          checkedAfterReveal = true
        }
      }
      humanStep(code, clients)
      steps++
    }
    expect(serverState(code).phase).toBe('Scoring')
    // The partner is known once the deal is scored.
    const scored = serverState(code)
    for (const client of clients) {
      expect(client.view!.partnerSeat).toBe(scored.partnerSeat)
    }
    if (scored.partnerSeat !== undefined) {
      expect(checkedBeforeReveal).toBe(true)
      // When the king falls in the very last trick, the deal is scored at once.
      const kingInLastTrick = scored.lastTrick?.some(entry => entry.card === scored.calledKing)
      if (!kingInLastTrick) {
        expect(checkedAfterReveal).toBe(true)
      }
    }
    expectNoLeaks(clients)
  })

  it('prise: everyone sees the dog before the taker discards it', async () => {
    const { code, clients } = await seatHumans(4, 4)
    clients[0]!.intent({ type: 'start' })
    const strategy: Strategy = {
      bid: (_seat, state) => state.bidSpoken.length === 0 ? 'prise' : 'passe'
    }
    const dealt = serverState(code)
    const dog = [...dealt.chien]
    while (serverState(code).phase === 'Bidding') {
      humanStep(code, clients, strategy)
    }
    expect(serverState(code).phase).toBe('DogEcarta')
    for (const client of clients) {
      expect([...(client.view!.chienRevealed ?? [])].sort()).toEqual([...dog].sort())
    }
    humanStep(code, clients) // taker discards
    expect(serverState(code).phase).toBe('ReadyToPlay')
    for (const client of clients) {
      expect(client.view!.chienRevealed).toBeNull()
    }
    expectNoLeaks(clients)
  })

  for (const contract of ['garde_sans', 'garde_contre'] as const) {
    it(`${contract}: nobody sees the dog`, async () => {
      const { code, clients } = await seatHumans(4, 4)
      clients[0]!.intent({ type: 'start' })
      const strategy: Strategy = {
        bid: (_seat, state) => state.bidSpoken.length === 0 ? contract : 'passe'
      }
      while (serverState(code).phase === 'Bidding') {
        humanStep(code, clients, strategy)
      }
      expect(serverState(code).phase).toBe('ReadyToPlay')
      for (const client of clients) {
        expect(client.view!.chienRevealed).toBeNull()
      }
      expectNoLeaks(clients)
    })
  }

  it('5 players: the dog is shown only after the king is called', async () => {
    const { code, clients } = await seatHumans(5, 5)
    clients[0]!.intent({ type: 'start' })
    const strategy: Strategy = {
      bid: (_seat, state) => state.bidSpoken.length === 0 ? 'garde' : 'passe'
    }
    const dog = [...serverState(code).chien]
    while (serverState(code).phase === 'Bidding') {
      humanStep(code, clients, strategy)
    }
    expect(serverState(code).phase).toBe('DogEcarta')
    for (const client of clients) {
      expect(client.view!.chienRevealed).toBeNull()
    }
    humanStep(code, clients) // taker calls a king
    expect(serverState(code).calledKing).toBeDefined()
    for (const client of clients) {
      expect([...(client.view!.chienRevealed ?? [])].sort()).toEqual([...dog].sort())
    }
    expectNoLeaks(clients)
  })

  it('a refresh where the old socket closes after the new one is up keeps the player seated', async () => {
    const { code, clients } = await seatHumans(4, 4)
    clients[0]!.intent({ type: 'start' })
    const guest = clients[2]!
    const oldPeer = guest.peer

    await guest.connect()
    guest.hello()
    guest.disconnect(oldPeer) // late close of the previous tab/socket

    vi.advanceTimersByTime(20_000)
    const state = serverState(code)
    expect(state.seats[2]).toMatchObject({ connected: true, controlledBy: 'human' })

    // And the refreshed client still gets live updates.
    let steps = 0
    while (steps < 6) {
      humanStep(code, clients)
      steps++
    }
    expectInSync(code, clients)
  })

  it('a player who drops is replaced by a bot, then takes the seat back with the same hand', async () => {
    const { code, clients } = await seatHumans(4, 4)
    clients[0]!.intent({ type: 'start' })
    const leaver = clients[1]!
    const seat = 1

    leaver.disconnect()
    expect(serverState(code).seats[seat]).toMatchObject({ connected: false, controlledBy: 'human' })
    for (const client of clients.filter(c => c !== leaver)) {
      expect(client.view!.seats[seat]!.connected).toBe(false)
    }

    vi.advanceTimersByTime(8_000)
    expect(serverState(code).seats[seat]!.controlledBy).toBe('bot')

    // The others keep playing; the bot plays seat 1 by itself.
    let guard = 0
    while (guard < 200 && serverState(code).phase !== 'Scoring') {
      if (!humanStep(code, clients.filter(c => c !== leaver))) {
        vi.advanceTimersByTime(6_000)
      }
      guard++
      if (serverState(code).trick.length === 0 && serverState(code).tricksWonBySeat.reduce((a, b) => a + b, 0) >= 3) {
        break
      }
    }

    await leaver.connect()
    leaver.hello()
    const state = serverState(code)
    expect(state.seats[seat]).toMatchObject({ connected: true, controlledBy: 'human' })
    expect([...leaver.view!.hand].sort()).toEqual([...state.hands[seat]!].sort())
    expectInSync(code, clients)
    expectNoLeaks(clients)
  })

  it('a player coming back while a bot is about to play does not freeze the table', async () => {
    const { code, clients } = await seatHumans(4, 2)
    const host = clients[0]!
    const guest = clients[1]!
    host.intent({ type: 'start' })

    // Play until it is a bot's turn with its timer pending.
    let guard = 0
    while (guard < 50 && humanStep(code, clients)) {
      guard++
    }
    const before = serverState(code)
    const botSeat = actingSeat(before)
    expect(before.seats[botSeat]!.controlledBy).toBe('bot')
    expect(gameStore.getRoom(code)!.botTimer).not.toBeNull()

    // Guest refreshes right then.
    guest.disconnect()
    await guest.connect()
    guest.hello()

    vi.advanceTimersByTime(6_000)
    const after = serverState(code)
    expect(after.version).toBeGreaterThan(before.version + 2)
  })

  it('a disconnected player is not left behind by the scoring screen', async () => {
    const { code, clients } = await seatHumans(4, 4)
    clients[0]!.intent({ type: 'start' })
    let guard = 0
    while (guard < 400 && serverState(code).phase !== 'Scoring') {
      humanStep(code, clients)
      guard++
    }
    expect(serverState(code).phase).toBe('Scoring')

    // Humans get time to read the scores: no auto-continue a few seconds later.
    vi.advanceTimersByTime(5_000)
    expect(serverState(code).phase).toBe('Scoring')

    // Two players press "Donne suivante" at the same time: one deal only, no error.
    const dealIndex = serverState(code).dealIndex
    clients[1]!.intent({ type: 'continue' })
    clients[2]!.intent({ type: 'continue' })
    expect(serverState(code).dealIndex).toBe(dealIndex + 1)
    expect(serverState(code).phase).toBe('Bidding')
    expect(clients[2]!.errors).toEqual([])
    expectInSync(code, clients)
  })

  it('the scoring screen still moves on by itself if every human is away', async () => {
    const { code, clients } = await seatHumans(4, 4)
    clients[0]!.intent({ type: 'start' })
    let guard = 0
    while (guard < 400 && serverState(code).phase !== 'Scoring') {
      humanStep(code, clients)
      guard++
    }
    expect(serverState(code).phase).toBe('Scoring')
    vi.advanceTimersByTime(60_000)
    expect(serverState(code).phase).not.toBe('Scoring')
  })

  it('a late visitor cannot join a running game and only sees public information', async () => {
    const { code, clients } = await seatHumans(4, 4)
    clients[0]!.intent({ type: 'start' })
    const visitor = new Client('visitor', code)
    await visitor.connect()
    visitor.hello()
    visitor.intent({ type: 'join', name: 'Curieux' })
    expect(visitor.view).toBeNull()
    expect(visitor.errors.map(e => e.error)).toContain('WRONG_PHASE')
    visitor.intent({ type: 'playCard', card: 'excuse' as CardId })
    expect(visitor.errors.at(-1)?.error).toBe('NOT_CONNECTED')
    expect(serverState(code).seats.some(seat => seat.userId === 'visitor')).toBe(false)
  })

  it('a player cannot act for another seat or out of turn', async () => {
    const { code, clients } = await seatHumans(4, 4)
    clients[0]!.intent({ type: 'start' })
    const state = serverState(code)
    const notTurn = clients.find(c => c.view!.seat !== state.currentSeat)!
    notTurn.intent({ type: 'bid', bid: 'passe' })
    expect(notTurn.errors.at(-1)?.error).toBe('NOT_YOUR_TURN')
    expect(serverState(code).version).toBe(state.version)
  })
})
