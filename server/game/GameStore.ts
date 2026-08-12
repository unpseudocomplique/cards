import { randomBytes } from 'node:crypto'
import { apply, chooseBotIntent, createEmptyGame, toPrivateView } from '~~/shared/tarot'
import type { Actor, ApplyResult, GameState, Intent } from '~~/shared/tarot'
import type { PeerHandle, Room } from './types'

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const DISCONNECT_GRACE_MS = 8_000
const TRICK_RESOLVE_PAUSE_MS = 1_800

type BotDelayKind = 'bid' | 'playLead' | 'playFollow' | 'discard' | 'king' | 'scoring' | 'trickPause' | 'chienReveal'

const BOT_DELAY_MS: Record<BotDelayKind, { min: number, max: number }> = {
  bid: { min: 900, max: 2_400 },
  playLead: { min: 700, max: 1_600 },
  playFollow: { min: 450, max: 1_200 },
  discard: { min: 1_400, max: 2_800 },
  king: { min: 1_100, max: 2_200 },
  scoring: { min: 1_600, max: 2_600 },
  trickPause: { min: TRICK_RESOLVE_PAUSE_MS, max: TRICK_RESOLVE_PAUSE_MS + 400 },
  // Let everyone read garde_sans / garde_contre dog before first card.
  chienReveal: { min: 4_800, max: 5_400 },
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
  if (state.phase === 'Bidding') {
    return randomDelayMs('bid')
  }
  if (state.phase === 'DogEcarta') {
    return randomDelayMs('discard')
  }
  if (
    state.phase === 'ReadyToPlay'
    && state.trick.length === 0
    && state.chien.length > 0
    && (state.bid?.contract === 'garde_sans' || state.bid?.contract === 'garde_contre')
  ) {
    return randomDelayMs('chienReveal')
  }
  if (state.phase === 'Trick' || state.phase === 'ReadyToPlay') {
    return state.trick.length === 0
      ? randomDelayMs('playLead')
      : randomDelayMs('playFollow')
  }
  return randomDelayMs('playFollow')
}

function findSeatByUserId(state: GameState, userId: string): number | null {
  const seat = state.seats.find(s => s.userId === userId)
  return seat?.seatId ?? null
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
      playerCount: opts.playerCount,
      endMode: opts.endMode,
      endValue: opts.endValue,
      deckId: opts.deckId,
      code,
    })

    this.rooms.set(code, {
      state,
      peers: new Map(),
      botTimer: null,
      disconnectTimers: new Map(),
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

  removePeer(code: string, userId: string): void {
    const room = this.rooms.get(code)
    if (!room) {
      return
    }
    room.peers.delete(userId)
  }

  applyIntent(code: string, intent: Intent, actor: Actor): ApplyResult {
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
    this.afterStateUpdate(code, actor.userId)
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
      index === seat ? { ...current, connected: false } : current,
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
          ? { ...current, controlledBy: 'bot' as const }
          : current,
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
        : current,
    )
    const state: GameState = { ...room.state, seats, version: room.state.version + 1 }
    room.state = state
    this.afterStateUpdate(code)
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

    // Scoring: auto-continue after a short pause so the phase is observable.
    if (state.phase === 'Scoring') {
      room.botTimer = setTimeout(() => {
        room.botTimer = null
        const current = this.rooms.get(code)
        if (!current || current.state.phase !== 'Scoring') {
          return
        }
        this.applyIntent(code, { type: 'continue' }, { userId: current.state.hostUserId })
      }, delayMs)
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

    if (
      state.phase !== 'Bidding'
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
        phase !== 'Bidding'
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

import { attachYjsPublisher } from './yjsPublisher'

attachYjsPublisher(gameStore)
