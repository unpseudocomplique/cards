import { onDisconnect, onHello } from '~~/server/game/DisconnectManager'
import { gameStore } from '~~/server/game/GameStore'
import type { PeerHandle } from '~~/server/game/types'
import { toPrivateView } from '~~/shared/tarot'
import type { Intent } from '~~/shared/tarot'
import { EMOTE_COOLDOWN_MS, isTableEmote } from '~~/shared/play/emotes'
import type { EmoteMessage } from '~~/shared/play/emotes'

type WsPeerContext = {
  code: string
  userId: string
  seat: number | null
  helloReceived: boolean
  handle: PeerHandle | null
  /** Last reaction sent, for the anti-spam cooldown. */
  lastEmoteAt: number
  /** Account photo, put on the seat when this person joins. */
  picture: string | null
}

const peerContext = new WeakMap<object, WsPeerContext>()
/**
 * `open` reads the session asynchronously and crossws does not wait for it, so
 * the client's first `hello` can arrive before the context exists (seen on page
 * refresh). Messages wait for the open to finish instead of being rejected.
 */
const peerReady = new WeakMap<object, Promise<void>>()

type WsPeer = { request: { url: string }, send: (data: string) => void, close: (code?: number, reason?: string) => void }

function resolveSeat(code: string, userId: string): number | null {
  const state = gameStore.get(code)
  if (!state) {
    return null
  }
  const seat = state.seats.findIndex(seatInfo => seatInfo.userId === userId)
  return seat >= 0 ? seat : null
}

function sendJson(peer: { send: (data: string) => void }, data: unknown): void {
  peer.send(JSON.stringify(data))
}

function sendError(peer: { send: (data: string) => void }, error: string, reason?: string): void {
  sendJson(peer, { type: 'error', error, reason })
}

function sendPrivate(peer: { send: (data: string) => void }, code: string, seat: number): void {
  const state = gameStore.get(code)
  if (!state) {
    sendError(peer, 'UNKNOWN_TABLE', `Table ${code} not found`)
    return
  }
  sendJson(peer, {
    type: 'private',
    private: toPrivateView(state, seat)
  })
}

type ClientMessage = { type: string, intent?: Intent, emote?: unknown }

function parseMessage(message: unknown): ClientMessage | null {
  const text = typeof message === 'string'
    ? message
    : message instanceof ArrayBuffer
      ? new TextDecoder().decode(message)
      : String(message)

  try {
    return JSON.parse(text) as ClientMessage
  } catch {
    return null
  }
}

function attachPeer(peer: object, ctx: WsPeerContext): PeerHandle {
  const handle: PeerHandle = {
    send: (data) => {
      sendJson(peer as { send: (data: string) => void }, data)
    }
  }
  ctx.handle = handle
  gameStore.setPeer(ctx.code, ctx.userId, handle)
  return handle
}

function completeHello(peer: object, ctx: WsPeerContext): boolean {
  const seat = resolveSeat(ctx.code, ctx.userId)
  if (seat === null) {
    sendError(peer as { send: (data: string) => void }, 'NOT_SEATED', 'No seat at this table')
    return false
  }

  const helloResult = onHello(ctx.code, ctx.userId)
  if (!helloResult.ok) {
    sendError(peer as { send: (data: string) => void }, helloResult.error, helloResult.reason)
    return false
  }

  ctx.seat = seat
  attachPeer(peer, ctx)
  ctx.helloReceived = true
  sendPrivate(peer as { send: (data: string) => void }, ctx.code, seat)
  return true
}

function readCode(peer: { request: { url: string } }): string {
  const url = new URL(peer.request.url)
  return url.searchParams.get('code')?.trim() ?? ''
}

async function openPeer(peer: WsPeer): Promise<void> {
  const code = readCode(peer)
  if (!code) {
    peer.close(4400, 'Missing code')
    return
  }

  if (!gameStore.get(code)) {
    peer.close(4404, 'Unknown table')
    return
  }

  try {
    const session = await requireUserSession(peer as unknown as Parameters<typeof requireUserSession>[0]) as { user: { id: string, picture?: string | null } }
    peerContext.set(peer, {
      code,
      userId: session.user.id,
      seat: resolveSeat(code, session.user.id),
      helloReceived: false,
      handle: null,
      lastEmoteAt: 0,
      picture: session.user.picture ?? null
    })
  } catch {
    peer.close(4401, 'Unauthorized')
  }
}

function handleMessage(peer: WsPeer, message: unknown): void {
  const ctx = peerContext.get(peer)
  if (!ctx) {
    sendError(peer, 'UNAUTHORIZED', 'Session not established')
    return
  }

  const parsed = parseMessage(message)
  if (!parsed?.type) {
    sendError(peer, 'INVALID_MESSAGE', 'Expected JSON message with type')
    return
  }

  if (parsed.type === 'hello') {
    if (ctx.helloReceived) {
      const seat = resolveSeat(ctx.code, ctx.userId)
      if (seat !== null) {
        sendPrivate(peer, ctx.code, seat)
      }
      return
    }

    const seat = resolveSeat(ctx.code, ctx.userId)
    if (seat === null) {
      sendError(peer, 'NOT_SEATED', 'Join the table before sending hello')
      return
    }

    completeHello(peer, ctx)
    return
  }

  if (parsed.type === 'intent') {
    if (!parsed.intent) {
      sendError(peer, 'INVALID_MESSAGE', 'Intent message requires intent')
      return
    }

    if (!ctx.helloReceived && parsed.intent.type !== 'join') {
      sendError(peer, 'NOT_CONNECTED', 'Send hello before intents')
      return
    }

    const actor = {
      userId: ctx.userId,
      seat: ctx.seat ?? undefined
    }
    // The seat photo comes from the session, never from the client.
    const intent = parsed.intent.type === 'join'
      ? { ...parsed.intent, picture: ctx.picture }
      : parsed.intent
    const result = gameStore.applyIntent(ctx.code, intent, actor)
    // Several players (or the fallback timer) can press "Donne suivante" at
    // once: only the first counts, the others just get the fresh state.
    if (!result.ok && (parsed.intent.type === 'continue' || parsed.intent.type === 'holdScoring') && result.error === 'WRONG_PHASE' && ctx.seat !== null) {
      sendPrivate(peer, ctx.code, ctx.seat)
      return
    }
    if (!result.ok) {
      sendError(peer, result.error, result.reason)
      return
    }

    if (parsed.intent.type === 'join') {
      completeHello(peer, ctx)
      return
    }

    if (ctx.seat !== null) {
      sendPrivate(peer, ctx.code, ctx.seat)
    }
    return
  }

  if (parsed.type === 'emote') {
    // Seated players only, from a fixed list, and not too often.
    if (!ctx.helloReceived || ctx.seat === null || !isTableEmote(parsed.emote)) {
      return
    }
    const now = Date.now()
    if (now - ctx.lastEmoteAt < EMOTE_COOLDOWN_MS) {
      return
    }
    ctx.lastEmoteAt = now
    const emote: EmoteMessage = { type: 'emote', seat: ctx.seat, emote: parsed.emote }
    gameStore.broadcast(ctx.code, emote)
    return
  }

  sendError(peer, 'INVALID_MESSAGE', `Unknown message type: ${parsed.type}`)
}

export default defineWebSocketHandler({
  async upgrade(request) {
    await requireUserSession(request)
  },

  open(peer) {
    const ready = openPeer(peer as unknown as WsPeer)
    peerReady.set(peer, ready)
    return ready
  },

  message(peer, message) {
    const ready = peerReady.get(peer)
    if (!peerContext.has(peer) && ready) {
      // Still reading the session: answer once it is known (keeps order).
      return ready.then(() => handleMessage(peer as unknown as WsPeer, message))
    }
    handleMessage(peer as unknown as WsPeer, message)
  },

  close(peer) {
    const ctx = peerContext.get(peer)
    if (!ctx) {
      return
    }

    peerContext.delete(peer)
    peerReady.delete(peer)
    // Only the user's current socket counts: a late close from a refreshed tab
    // must not mark a player who is already back as gone.
    if (ctx.helloReceived && gameStore.removePeer(ctx.code, ctx.userId, ctx.handle ?? undefined)) {
      onDisconnect(ctx.code, ctx.userId)
    }
  }
})
