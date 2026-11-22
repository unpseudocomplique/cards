import { randomBytes } from 'node:crypto'
import { apply, botChelemIntent, chooseBotIntent, chooseCutIntent, createEmptyGame, TAKEOVER_BOT_LEVEL, toPrivateView } from '~~/shared/tarot'
import type { Actor, ApplyResult, GameState, Intent } from '~~/shared/tarot'
import type { PeerHandle, Room } from './types'

import { attachYjsPublisher } from './yjsPublisher'

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const DISCONNECT_GRACE_MS = 8_000
const TRICK_RESOLVE_PAUSE_MS = 3_600
/**
 * Scoring with people at the table: wait for someone to press "Donne suivante",
 * and only move on alone if nobody does for this long.
 */
/** With people at the table, the deal summary moves on by itself after this (countdown shown). */
const SCORING_AUTO_CONTINUE_MS = 15_000
/** Someone pressed Pause: wait for a "Continuer", but never forever. */
const SCORING_HELD_FALLBACK_MS = 180_000
/** A person who does not cut the pack: cut for them after this long. */
const CUT_HUMAN_FALLBACK_MS = 40_000

type BotDelayKind = 'cut' | 'bid' | 'playLead' | 'playFollow' | 'king' | 'scoring' | 'trickPause' | 'chienReveal' | 'openingLead'

const BOT_DELAY_MS: Record<BotDelayKind, { min: number, max: number }> = {
  // Leave time to see the pack put down and the cut happen.
  cut: { min: 1_600, max: 2_600 },
  bid: { min: 900, max: 2_400 },
  playLead: { min: 700, max: 1_600 },
  playFollow: { min: 450, max: 1_200 },
  king: { min: 1_100, max: 2_200 },
  scoring: { min: 1_600, max: 2_600 },
  // Match client hold + collect so bots don't play over the summary.
  trickPause: { min: TRICK_RESOLVE_PAUSE_MS, max: TRICK_RESOLVE_PAUSE_MS + 500 },
  // Prise / garde: let everyone read the dog before a bot taker discards it.
  chienReveal: { min: 4_800, max: 5_400 },
  // First card of the deal: leave a human taker time to announce a chelem.
  openingLead: { min: 4_000, max: 4_800 }
}

function randomCode(): string {
  const length = 6 + (randomBytes(1)[0]! % 3)
  const bytes = randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[bytes[i]! % CODE_CHARS.length]
  }
  return code
}

function randomDelayMs(kind: BotDelayKind): number {
  const { min, max } = BOT_DELAY_MS[kind]
  return min + Math.floor(Math.random() * (max - min + 1))
}

function botDelayForState(state: GameState): number {
  if (state.phase === 'Scoring') {
    return randomDelayMs('scoring')
  }
  if (
    state.playerCount === 5
    && state.bid
    && !state.calledKing
    && (state.phase === 'DogEcarta' || state.phase === 'ReadyToPlay')
  ) {
    return randomDelayMs('king')
  }
  if (state.phase === 'Cutting') {
    return randomDelayMs('cut')
  }
  if (state.phase === 'Bidding') {
    return randomDelayMs('bid')
  }
  if (state.phase === 'DogEcarta') {
    return randomDelayMs('chienReveal')
  }
  if (state.phase === 'ReadyToPlay' && state.bid && !state.chelemAnnounce && humanAtSeat(state, state.bid.seat)) {
    return randomDelayMs('openingLead')
  }
  if (state.phase === 'Trick' || state.phase === 'ReadyToPlay') {
    return state.trick.length === 0
      ? randomDelayMs('playLead')
      : randomDelayMs('playFollow')
  }
  return randomDelayMs('playFollow')
}

function humanAtSeat(state: GameState, seat: number): boolean {
  const info = state.seats[seat]
  return Boolean(info?.userId && info.controlledBy === 'human' && info.connected)
}

function findSeatByUserId(state: GameState, userId: string): number | null {
  const seat = state.seats.find(s => s.userId === userId)
  return seat?.seatId ?? null
}

function humanAtTable(state: GameState): boolean {
  return state.seats.some(seat => seat.userId && seat.controlledBy === 'human' && seat.connected)
}

class GameStore {
  private rooms = new Map<string, Room>()
  private onStateChange?: (code: string, state: GameState) => void

  setOnStateChange(callback: (code: string, state: GameState) => void): void {
    this.onStateChange = callback
  }

  resetForTests(): void {
    for (const room of this.rooms.values()) {
      if (room.botTimer) {
        clearTimeout(room.botTimer)
      }
      for (const timer of room.disconnectTimers.values()) {
        clearTimeout(timer)
      }
    }
    this.rooms.clear()
  }

  createTable(opts: {
    hostUserId: string
    hostName: string
    hostPicture?: string | null
    playerCount: 3 | 4 | 5
    endMode: 'threshold' | 'deals'
    endValue: number
    deckId: string
  }): { code: string } {
    let code = randomCode()
    while (this.rooms.has(code)) {
      code = randomCode()
    }

    const state = createEmptyGame({
      hostUserId: opts.hostUserId,
      hostName: opts.hostName,
      hostPicture: opts.hostPicture ?? null,
      playerCount: opts.playerCount,
      endMode: opts.endMode,
      endValue: opts.endValue,
      deckId: opts.deckId,
      code
    })
    // The engine deals from a counter; start each table somewhere random or
    // every table would get the very same deals.
    state.rngCounter = randomBytes(4).readUInt32BE(0) % 0x7fffffff

    this.rooms.set(code, {
      state,
      peers: new Map(),
      botTimer: null,
      disconnectTimers: new Map()
    })

    return { code }
  }

  get(code: string): GameState | undefined {
    return this.rooms.get(code)?.state
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code)
  }

  setPeer(code: string, userId: string, peer: PeerHandle): void {
    const room = this.rooms.get(code)
    if (!room) {
      return
    }
    room.peers.set(userId, peer)
  }

  /**
   * Forget a closed socket. Returns false when that user already has a newer
   * socket (refresh / reconnect where the old close arrives late): the player
   * is still here and must not be marked as gone.
   */
  removePeer(code: string, userId: string, peer?: PeerHandle): boolean {
    const room = this.rooms.get(code)
    if (!room) {
      return false
    }
    if (peer && room.peers.get(userId) !== peer) {
      return false
    }
    room.peers.delete(userId)
    return true
  }

  /**
   * `byServer`: the server acts for that player (timer fallback), so their own
   * socket gets the update too; normally the WS handler answers the actor.
   */
  applyIntent(code: string, intent: Intent, actor: Actor, byServer = false): ApplyResult {
    const room = this.rooms.get(code)
    if (!room) {
      return { ok: false, error: 'UNKNOWN_TABLE', reason: `Table ${code} not found` }
    }

    const result = apply(room.state, intent, actor)
    if (!result.ok) {
      console.warn(`[tarot] ${code} intent ${intent.type} rejected: ${result.error} — ${result.reason}`)
      return result
    }

    room.state = result.state
    console.log(`[tarot] ${code} intent ${intent.type} ok → phase=${result.state.phase} v=${result.state.version}`)
    this.afterStateUpdate(code, byServer ? undefined : actor.userId)
    const trickJustWon = result.events.some(event => event.type === 'trickWon')
    this.scheduleIfBotTurn(code, trickJustWon ? 'trickPause' : undefined)
    return result
  }

  onDisconnect(code: string, userId: string): void {
    const room = this.rooms.get(code)
    if (!room) {
      return
    }

    const seat = findSeatByUserId(room.state, userId)
    if (seat === null) {
      return
    }

    this.clearDisconnectTimer(room, userId)

    const seats = room.state.seats.map((current, index) =>
      index === seat ? { ...current, connected: false } : current
    )
    room.state = { ...room.state, seats, version: room.state.version + 1 }
    this.afterStateUpdate(code)

    const timer = setTimeout(() => {
      room.disconnectTimers.delete(userId)
      const currentSeat = findSeatByUserId(room.state, userId)
      if (currentSeat === null) {
        return
      }
      const seatInfo = room.state.seats[currentSeat]
      if (!seatInfo || seatInfo.connected) {
        return
      }

      const nextSeats = room.state.seats.map((current, index) =>
        index === currentSeat
          ? { ...current, controlledBy: 'bot' as const, botLevel: current.botLevel ?? TAKEOVER_BOT_LEVEL }
          : current
      )
      room.state = { ...room.state, seats: nextSeats, version: room.state.version + 1 }
      this.afterStateUpdate(code)
      this.scheduleIfBotTurn(code)
    }, DISCONNECT_GRACE_MS)

    room.disconnectTimers.set(userId, timer)
  }

  onHello(code: string, userId: string): ApplyResult {
    const room = this.rooms.get(code)
    if (!room) {
      return { ok: false, error: 'UNKNOWN_TABLE', reason: `Table ${code} not found` }
    }

    const seat = findSeatByUserId(room.state, userId)
    if (seat === null) {
      return { ok: false, error: 'UNAUTHORIZED', reason: 'No seat for this user at this table' }
    }

    this.clearDisconnectTimer(room, userId)
    this.clearBotTimer(room)

    const seats = room.state.seats.map((current, index) =>
      index === seat
        ? { ...current, connected: true, controlledBy: 'human' as const }
        : current
    )
    const state: GameState = { ...room.state, seats, version: room.state.version + 1 }
    room.state = state
    this.afterStateUpdate(code)
    // The bot timer was cancelled above (it may have been for this seat); re-arm
    // it for whoever is next, or the table would wait forever on a bot turn.
    this.scheduleIfBotTurn(code)
    return { ok: true, state, events: [] }
  }

  scheduleIfBotTurn(code: string, delayKind?: BotDelayKind): void {
    const room = this.rooms.get(code)
    if (!room) {
      return
    }

    this.clearBotTimer(room)

    const state = room.state
    const delayMs = delayKind
      ? randomDelayMs(delayKind)
      : botDelayForState(state)

    // Scoring: bots-only tables move on after a short pause; with people at the
    // table, a countdown is shown and the next deal starts by itself unless
    // someone pressed Pause (then a long fallback if everyone is away).
    if (state.phase === 'Scoring') {
      let scoringDelay: number
      if (state.scoringHeld) {
        scoringDelay = SCORING_HELD_FALLBACK_MS
      } else {
        const now = Date.now()
        const planned = state.autoContinueAt && state.autoContinueAt > now
          ? state.autoContinueAt
          : now + (humanAtTable(state) ? SCORING_AUTO_CONTINUE_MS : delayMs)
        scoringDelay = planned - now
        if (state.autoContinueAt !== planned) {
          room.state = { ...state, autoContinueAt: planned, version: state.version + 1 }
          this.afterStateUpdate(code)
        }
      }
      room.botTimer = setTimeout(() => {
        room.botTimer = null
        const current = this.rooms.get(code)
        if (!current || current.state.phase !== 'Scoring') {
          return
        }
        this.applyIntent(code, { type: 'continue' }, { userId: current.state.hostUserId }, true)
      }, scoringDelay)
      return
    }

    // A person cuts with the slider; if they never do, cut for them so the
    // table does not wait forever.
    if (state.phase === 'Cutting' && humanAtSeat(state, state.currentSeat)) {
      const cutterSeat = state.currentSeat
      room.botTimer = setTimeout(() => {
        room.botTimer = null
        const current = this.rooms.get(code)
        const seatInfo = current?.state.seats[cutterSeat]
        if (!current || current.state.phase !== 'Cutting' || current.state.currentSeat !== cutterSeat || !seatInfo?.userId) {
          return
        }
        this.applyIntent(code, chooseCutIntent(current.state, cutterSeat), { userId: seatInfo.userId, seat: cutterSeat }, true)
      }, CUT_HUMAN_FALLBACK_MS)
      return
    }

    // No bot actions in lobby / dealing / terminal match.
    if (
      state.phase === 'Lobby'
      || state.phase === 'Dealing'
      || state.phase === 'MatchOver'
    ) {
      return
    }

    // 5p: taker must call a king before discard/play (may not be currentSeat yet).
    if (
      state.playerCount === 5
      && state.bid
      && !state.calledKing
      && (state.phase === 'DogEcarta' || state.phase === 'ReadyToPlay')
    ) {
      const takerSeat = state.bid.seat
      const taker = state.seats[takerSeat]
      if (!taker?.userId || taker.controlledBy !== 'bot') {
        return
      }
      room.botTimer = setTimeout(() => {
        room.botTimer = null
        const current = this.rooms.get(code)
        if (!current?.state.bid || current.state.calledKing) {
          return
        }
        if (
          current.state.phase !== 'DogEcarta'
          && current.state.phase !== 'ReadyToPlay'
        ) {
          return
        }
        const seatInfo = current.state.seats[takerSeat]
        if (!seatInfo?.userId || seatInfo.controlledBy !== 'bot') {
          return
        }
        try {
          const intent = chooseBotIntent(current.state, takerSeat)
          this.applyIntent(code, intent, { userId: seatInfo.userId, seat: takerSeat })
        } catch (error) {
          console.error(`Bot king call failed for table ${code}:`, error)
        }
      }, delayMs)
      return
    }

    // A bot taker with an unbeatable hand announces a chelem before the first
    // card, even when another seat leads (the announcement gives it the lead).
    if (state.phase === 'ReadyToPlay' && state.bid && state.bid.seat !== state.currentSeat) {
      const takerSeat = state.bid.seat
      const taker = state.seats[takerSeat]
      if (taker?.userId && taker.controlledBy === 'bot' && botChelemIntent(state, takerSeat)) {
        room.botTimer = setTimeout(() => {
          room.botTimer = null
          const current = this.rooms.get(code)
          const seatInfo = current?.state.seats[takerSeat]
          if (!current || !seatInfo?.userId || seatInfo.controlledBy !== 'bot') {
            return
          }
          const intent = botChelemIntent(current.state, takerSeat)
          if (intent) {
            this.applyIntent(code, intent, { userId: seatInfo.userId, seat: takerSeat })
          }
        }, randomDelayMs('king'))
        return
      }
    }

    if (
      state.phase !== 'Cutting'
      && state.phase !== 'Bidding'
      && state.phase !== 'DogEcarta'
      && state.phase !== 'ReadyToPlay'
      && state.phase !== 'Trick'
    ) {
      return
    }

    const seat = state.currentSeat
    const seatInfo = state.seats[seat]
    if (!seatInfo?.userId || seatInfo.controlledBy !== 'bot') {
      return
    }

    room.botTimer = setTimeout(() => {
      room.botTimer = null
      const current = this.rooms.get(code)
      if (!current) {
        return
      }

      const phase = current.state.phase
      if (
        phase !== 'Cutting'
        && phase !== 'Bidding'
        && phase !== 'DogEcarta'
        && phase !== 'ReadyToPlay'
        && phase !== 'Trick'
        && phase !== 'Scoring'
      ) {
        return
      }

      const activeSeat = current.state.currentSeat
      const activeSeatInfo = current.state.seats[activeSeat]
      if (!activeSeatInfo?.userId || activeSeatInfo.controlledBy !== 'bot') {
        return
      }

      try {
        const intent = chooseBotIntent(current.state, activeSeat)
        this.applyIntent(code, intent, { userId: activeSeatInfo.userId, seat: activeSeat })
      } catch (error) {
        console.error(`Bot turn failed for table ${code}:`, error)
      }
    }, delayMs)
  }

  private clearBotTimer(room: Room): void {
    if (room.botTimer) {
      clearTimeout(room.botTimer)
      room.botTimer = null
    }
  }

  private clearDisconnectTimer(room: Room, userId: string): void {
    const timer = room.disconnectTimers.get(userId)
    if (timer) {
      clearTimeout(timer)
      room.disconnectTimers.delete(userId)
    }
  }

  private afterStateUpdate(code: string, actorUserId?: string): void {
    this.notifyPeers(code, actorUserId)
    const room = this.rooms.get(code)
    if (room && this.onStateChange) {
      this.onStateChange(code, room.state)
    }
  }

  /** Send a message to every connected player of the table. */
  broadcast(code: string, data: unknown): void {
    const room = this.rooms.get(code)
    if (!room) {
      return
    }
    for (const peer of room.peers.values()) {
      peer.send(data)
    }
  }

  private notifyPeers(code: string, excludeUserId?: string): void {
    const room = this.rooms.get(code)
    if (!room) {
      return
    }

    // Actor already gets a private snapshot from the WS handler; push private to others
    // so the lobby/table updates even when Yjs is down.
    for (const [userId, peer] of room.peers) {
      if (excludeUserId && userId === excludeUserId) {
        continue
      }
      peer.send({ type: 'applied' as const, publicVersion: room.state.version })
      const seat = findSeatByUserId(room.state, userId)
      if (seat !== null) {
        peer.send({ type: 'private' as const, private: toPrivateView(room.state, seat) })
      }
    }
  }
}

export const gameStore = new GameStore()

attachYjsPublisher(gameStore)
