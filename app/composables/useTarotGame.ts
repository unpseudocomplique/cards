import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type { Intent, PrivateGameView, PublicGameView } from '~~/shared/tarot'
import type { EmoteMessage, TableEmote } from '~~/shared/play/emotes'

export type { Intent, PrivateGameView, PublicGameView } from '~~/shared/tarot'

type AwarenessUser = {
  userId: string
  name: string
  seat?: number
}

type ServerMessage =
  | { type: 'private', private?: PrivateGameView }
  | { type: 'error', error: string, reason?: string }
  | { type: 'applied', publicVersion?: number }
  | EmoteMessage

function localizeGameError(reason: string | undefined, fallback: string | undefined): string {
  const raw = reason ?? fallback ?? 'Erreur'
  if (/must strictly overcall current winning bid/i.test(raw)) {
    const match = raw.match(/winning bid (\w+)/i)
    const labels: Record<string, string> = {
      prise: 'Prise',
      garde: 'Garde',
      garde_sans: 'Garde sans',
      garde_contre: 'Garde contre',
    }
    const current = match?.[1] ? (labels[match[1]] ?? match[1]) : 'enchère en cours'
    return `Il faut surenchérir (au-dessus de ${current}).`
  }
  if (/already spoken/i.test(raw)) {
    return 'Vous avez déjà parlé pour cette donne.'
  }
  if (/not seat .* turn/i.test(raw)) {
    return 'Ce n’est pas votre tour d’enchérir.'
  }
  if (/bidding round is already complete/i.test(raw)) {
    return 'Les enchères sont terminées.'
  }
  if (/can only join during lobby/i.test(raw)) {
    return 'La partie a déjà commencé : vous ne pouvez plus vous asseoir à cette table.'
  }
  if (/no empty seats/i.test(raw)) {
    return 'La table est complète.'
  }
  if (/expected seat \d+, got \d+/i.test(raw)) {
    return 'Ce n’est pas votre tour.'
  }
  if (/is not a legal move/i.test(raw)) {
    return 'Cette carte ne peut pas être jouée maintenant.'
  }
  return raw
}

function resolveCode(code: Ref<string> | string): Ref<string> {
  return isRef(code) ? code : ref(code)
}

export function useTarotGame(code: Ref<string> | string) {
  const codeRef = resolveCode(code)
  const config = useRuntimeConfig()
  const requestURL = useRequestURL()
  const { user } = useUserSession()

  const publicState = ref<PublicGameView | null>(null)
  const privateState = ref<PrivateGameView | null>(null)
  const connected = ref(false)
  const error = ref<string | null>(null)
  const awarenessUsers = ref<AwarenessUser[]>([])
  const { emotes, showEmote } = useTableEmotes()
  const yjsConnected = ref(false)
  const publicSyncDegraded = computed(() => connected.value && !yjsConnected.value)

  let ws: WebSocket | null = null
  let provider: WebsocketProvider | null = null
  let doc: Y.Doc | null = null
  let publicMapObserver: ((event: Y.YMapEvent<unknown>) => void) | null = null
  let awarenessChangeHandler: (() => void) | null = null
  let disposed = false
  let generation = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  /** Server closed for good (unknown table, not signed in): don't retry. */
  let reconnectBlocked = false

  function displayName(): string {
    return user.value?.username ?? 'Player'
  }

  function syncAwarenessLocalState(seat?: number) {
    if (!provider || !user.value) {
      return
    }
    provider.awareness.setLocalState({
      userId: user.value.id,
      name: displayName(),
      ...(seat !== undefined ? { seat } : {}),
    })
  }

  function syncAwarenessUsers() {
    if (!provider) {
      awarenessUsers.value = []
      return
    }

    const users: AwarenessUser[] = []
    provider.awareness.getStates().forEach((state, clientId) => {
      if (!state) {
        return
      }
      users.push({
        userId: String(state.userId ?? clientId),
        name: String(state.name ?? 'Unknown'),
        seat: typeof state.seat === 'number' ? state.seat : undefined,
      })
    })
    awarenessUsers.value = users
  }

  function sendJson(payload: unknown) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload))
    }
  }

  function sendHello() {
    sendJson({ type: 'hello' })
  }

  function sendEmote(emote: TableEmote) {
    sendJson({ type: 'emote', emote })
  }

  function sendIntent(intent: Intent) {
    sendJson({ type: 'intent', intent })
  }

  function join(name?: string) {
    sendIntent({ type: 'join', name: name ?? displayName() })
  }

  /**
   * Public state arrives from three places (private snapshot, Yjs, HTTP
   * fallback) that can land out of order: never step back to an older version.
   */
  function setPublicState(view: PublicGameView) {
    const current = publicState.value
    if (current && current.code === view.code && view.version < current.version) {
      return
    }
    publicState.value = view
  }

  function applyPrivateView(view: PrivateGameView) {
    privateState.value = view
    const { seat: _seat, hand: _hand, legalMoves: _legalMoves, ...publicView } = view
    setPublicState(publicView)
    syncAwarenessLocalState(view.seat)
    error.value = null
  }

  async function refreshPublic() {
    const gameCode = codeRef.value
    if (!gameCode) {
      return
    }
    try {
      setPublicState(await $fetch<PublicGameView>(`/api/game/${gameCode}`))
    } catch {
      // Keep last known public snapshot.
    }
  }

  function handleWsMessage(event: MessageEvent) {
    let message: ServerMessage
    try {
      message = JSON.parse(String(event.data)) as ServerMessage
    } catch {
      return
    }

    switch (message.type) {
      case 'private':
        if (message.private) {
          applyPrivateView(message.private)
        }
        break
      case 'error':
        // Host is already seated at create; guests get NOT_SEATED before join.
        if (message.error === 'NOT_SEATED' || message.reason === 'Already seated at this table') {
          break
        }
        error.value = localizeGameError(message.reason, message.error)
        break
      case 'applied':
        // Fallback when Yjs public sync is unavailable or lagged.
        void refreshPublic()
        break
      case 'emote':
        showEmote(message.seat, message.emote)
        break
    }
  }

  function closeConnections() {
    if (publicMapObserver && doc) {
      doc.getMap('public').unobserve(publicMapObserver)
      publicMapObserver = null
    }

    if (awarenessChangeHandler && provider) {
      provider.awareness.off('change', awarenessChangeHandler)
      awarenessChangeHandler = null
    }

    provider?.destroy()
    provider = null

    doc?.destroy()
    doc = null

    closeSocket()
  }

  function closeSocket() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      ws.close()
      ws = null
    }
  }

  /**
   * Game socket. Phones drop it when the screen locks or the network changes:
   * reconnect on our own so the player gets their seat back from the bot.
   */
  function openSocket(gameCode: string, setupGeneration: number) {
    closeSocket()
    const wsOrigin = requestURL.origin.replace(/^http/, 'ws')
    const socket = new WebSocket(`${wsOrigin}/game/ws?code=${encodeURIComponent(gameCode)}`)
    ws = socket

    socket.onopen = () => {
      if (isStaleSetup(setupGeneration) || ws !== socket) {
        return
      }
      reconnectAttempts = 0
      connected.value = true
      error.value = null
      sendHello()
    }

    socket.onmessage = handleWsMessage
    socket.onclose = (event: CloseEvent) => {
      if (ws !== socket) {
        return
      }
      connected.value = false
      ws = null
      // 4400 / 4401 / 4404: bad code, signed out, table gone. Retrying won't help.
      if (event.code >= 4400 && event.code < 4500) {
        reconnectBlocked = true
        if (event.code === 4404) {
          error.value = 'Cette table n’existe plus.'
        }
        return
      }
      scheduleReconnect(gameCode, setupGeneration)
    }
    socket.onerror = () => {
      // onclose follows and handles the retry.
    }
  }

  function scheduleReconnect(gameCode: string, setupGeneration: number) {
    if (isStaleSetup(setupGeneration) || reconnectBlocked || reconnectTimer) {
      return
    }
    const delay = Math.min(500 * 2 ** reconnectAttempts, 5_000)
    reconnectAttempts++
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (isStaleSetup(setupGeneration) || ws) {
        return
      }
      openSocket(gameCode, setupGeneration)
    }, delay)
  }

  /** Back to the tab / network is back: reconnect right away instead of waiting. */
  function reconnectNow() {
    const gameCode = codeRef.value
    if (!import.meta.client || disposed || reconnectBlocked || !gameCode) {
      return
    }
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    reconnectAttempts = 0
    openSocket(gameCode, generation)
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      reconnectNow()
    }
  }

  function teardown() {
    generation++
    disposed = true
    connected.value = false
    yjsConnected.value = false
    awarenessUsers.value = []
    closeConnections()
  }

  function isStaleSetup(setupGeneration: number) {
    return disposed || setupGeneration !== generation
  }

  async function setup(gameCode: string, setupGeneration: number) {
    if (!import.meta.client || !gameCode) {
      return
    }

    error.value = null
    privateState.value = null
    reconnectAttempts = 0
    reconnectBlocked = false

    try {
      publicState.value = await $fetch<PublicGameView>(`/api/game/${gameCode}`)
    } catch {
      publicState.value = null
    }

    if (isStaleSetup(setupGeneration)) {
      return
    }

    openSocket(gameCode, setupGeneration)

    if (isStaleSetup(setupGeneration)) {
      closeConnections()
      return
    }

    doc = new Y.Doc()
    const publicMap = doc.getMap('public')

    publicMapObserver = () => {
      const snapshot = publicMap.get('snapshot') as PublicGameView | undefined
      // The Yjs room can hold a snapshot from an older table with the same code.
      if (snapshot && snapshot.code === gameCode) {
        setPublicState(snapshot)
      }
    }
    publicMap.observe(publicMapObserver)
    publicMapObserver()

    provider = new WebsocketProvider(
      String(config.public.yjsWebsocketUrl),
      `tarot-${gameCode}`,
      doc,
      {
        connect: true,
        disableBc: true,
      },
    )

    provider.on('status', (event: { status: string }) => {
      if (isStaleSetup(setupGeneration)) {
        return
      }
      yjsConnected.value = event.status === 'connected'
    })
    provider.on('connection-error', () => {
      if (!isStaleSetup(setupGeneration)) {
        yjsConnected.value = false
      }
    })
    // If Yjs never connects within a few seconds, mark degraded.
    setTimeout(() => {
      if (!isStaleSetup(setupGeneration) && provider && !provider.wsconnected) {
        yjsConnected.value = false
      }
    }, 3_000)

    if (isStaleSetup(setupGeneration)) {
      closeConnections()
      return
    }

    syncAwarenessLocalState(privateState.value?.seat)
    awarenessChangeHandler = syncAwarenessUsers
    provider.awareness.on('change', awarenessChangeHandler)
    syncAwarenessUsers()
  }

  watch(
    () => user.value?.id,
    () => {
      syncAwarenessLocalState(privateState.value?.seat)
    },
  )

  watch(
    codeRef,
    (gameCode, previousCode) => {
      if (!import.meta.client) {
        return
      }
      if (gameCode === previousCode && ws) {
        return
      }
      teardown()
      if (!gameCode) {
        publicState.value = null
        privateState.value = null
        error.value = null
        return
      }
      const setupGeneration = generation
      disposed = false
      void setup(gameCode, setupGeneration)
    },
    { immediate: true },
  )

  if (import.meta.client) {
    window.addEventListener('online', reconnectNow)
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  onUnmounted(() => {
    if (import.meta.client) {
      window.removeEventListener('online', reconnectNow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    teardown()
  })

  return {
    publicState,
    privateState,
    connected,
    error,
    publicSyncDegraded,
    sendIntent,
    sendEmote,
    emotes,
    join,
    awarenessUsers,
  }
}
