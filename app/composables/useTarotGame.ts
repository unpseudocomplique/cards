import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type { Intent, PrivateGameView, PublicGameView } from '~~/shared/tarot'

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
  const yjsConnected = ref(false)
  const publicSyncDegraded = computed(() => connected.value && !yjsConnected.value)

  let ws: WebSocket | null = null
  let provider: WebsocketProvider | null = null
  let doc: Y.Doc | null = null
  let publicMapObserver: ((event: Y.YMapEvent<unknown>) => void) | null = null
  let awarenessChangeHandler: (() => void) | null = null
  let disposed = false
  let generation = 0

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

  function sendIntent(intent: Intent) {
    sendJson({ type: 'intent', intent })
  }

  function join(name?: string) {
    sendIntent({ type: 'join', name: name ?? displayName() })
  }

  function applyPrivateView(view: PrivateGameView) {
    privateState.value = view
    const { seat: _seat, hand: _hand, legalMoves: _legalMoves, ...publicView } = view
    publicState.value = publicView
    syncAwarenessLocalState(view.seat)
    error.value = null
  }

  async function refreshPublic() {
    const gameCode = codeRef.value
    if (!gameCode) {
      return
    }
    try {
      publicState.value = await $fetch<PublicGameView>(`/api/game/${gameCode}`)
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

    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      ws.close()
      ws = null
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

    try {
      publicState.value = await $fetch<PublicGameView>(`/api/game/${gameCode}`)
    } catch {
      publicState.value = null
    }

    if (isStaleSetup(setupGeneration)) {
      return
    }

    const wsOrigin = requestURL.origin.replace(/^http/, 'ws')
    ws = new WebSocket(`${wsOrigin}/game/ws?code=${encodeURIComponent(gameCode)}`)

    ws.onopen = () => {
      if (isStaleSetup(setupGeneration)) {
        return
      }
      connected.value = true
      sendHello()
    }

    ws.onmessage = handleWsMessage
    ws.onclose = () => {
      connected.value = false
    }
    ws.onerror = () => {
      if (isStaleSetup(setupGeneration)) {
        return
      }
      error.value = 'WebSocket connection failed'
    }

    if (isStaleSetup(setupGeneration)) {
      closeConnections()
      return
    }

    doc = new Y.Doc()
    const publicMap = doc.getMap('public')

    publicMapObserver = () => {
      const snapshot = publicMap.get('snapshot')
      if (snapshot) {
        publicState.value = snapshot as PublicGameView
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

  onUnmounted(() => {
    teardown()
  })

  return {
    publicState,
    privateState,
    connected,
    error,
    publicSyncDegraded,
    sendIntent,
    join,
    awarenessUsers,
  }
}
