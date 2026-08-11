import { onDisconnect, onHello } from '~~/server/game/DisconnectManager'
import { gameStore } from '~~/server/game/GameStore'
import type { PeerHandle } from '~~/server/game/types'
import { toPrivateView } from '~~/shared/tarot'
import type { Intent } from '~~/shared/tarot'

type WsPeerContext = {
  code: string
  userId: string
  seat: number | null
  helloReceived: boolean
}

const peerContext = new WeakMap<object, WsPeerContext>()

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
    private: toPrivateView(state, seat),
  })
}

function parseMessage(message: unknown): { type: string, intent?: Intent } | null {
  const text = typeof message === 'string'
    ? message
    : message instanceof ArrayBuffer
      ? new TextDecoder().decode(message)
      : String(message)

  try {
    return JSON.parse(text) as { type: string, intent?: Intent }
  } catch {
    return null
  }
}

function attachPeer(peer: object, ctx: WsPeerContext): PeerHandle {
  const handle: PeerHandle = {
    send: (data) => {
      sendJson(peer as { send: (data: string) => void }, data)
    },
  }
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

export default defineWebSocketHandler({
  async upgrade(request) {
    await requireUserSession(request)
  },

  async open(peer) {
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
      const session = await requireUserSession(peer) as { user: { id: string } }
      peerContext.set(peer, {
        code,
        userId: session.user.id,
        seat: resolveSeat(code, session.user.id),
        helloReceived: false,
      })
    } catch {
      peer.close(4401, 'Unauthorized')
    }
  },

  message(peer, message) {
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
        seat: ctx.seat ?? undefined,
      }
      const result = gameStore.applyIntent(ctx.code, parsed.intent, actor)
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

    sendError(peer, 'INVALID_MESSAGE', `Unknown message type: ${parsed.type}`)
  },

  close(peer) {
    const ctx = peerContext.get(peer)
    if (!ctx) {
      return
    }

    peerContext.delete(peer)
    if (ctx.helloReceived) {
      gameStore.removePeer(ctx.code, ctx.userId)
      onDisconnect(ctx.code, ctx.userId)
    }
  },
})
