import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { toPublicView } from '~~/shared/tarot'
import type { GameState, PublicGameView } from '~~/shared/tarot'

type RoomConnection = {
  doc: Y.Doc
  provider: WebsocketProvider
}

type StatePublisher = {
  setOnStateChange: (callback: (code: string, state: GameState) => void) => void
}

const rooms = new Map<string, RoomConnection>()

function roomName(code: string): string {
  return `tarot-${code}`
}

function getYjsUrl(): string | null {
  try {
    const config = useRuntimeConfig()
    return String(config.public.yjsWebsocketUrl)
  } catch {
    return null
  }
}

function getConnection(code: string): RoomConnection | null {
  const serverUrl = getYjsUrl()
  if (!serverUrl) {
    return null
  }

  let connection = rooms.get(code)
  if (!connection) {
    const doc = new Y.Doc()
    const provider = new WebsocketProvider(serverUrl, roomName(code), doc, {
      connect: true,
      disableBc: true,
    })
    connection = { doc, provider }
    rooms.set(code, connection)
  }
  return connection
}

export function publishPublic(code: string, view: PublicGameView): void {
  const connection = getConnection(code)
  if (!connection) {
    return
  }

  const { doc } = connection
  const publicMap = doc.getMap('public')
  doc.transact(() => {
    publicMap.set('snapshot', view)
    publicMap.set('version', view.version)
  })
}

export function destroyRoom(code: string): void {
  const connection = rooms.get(code)
  if (!connection) {
    return
  }
  connection.provider.destroy()
  connection.doc.destroy()
  rooms.delete(code)
}

export function attachYjsPublisher(store: StatePublisher): void {
  store.setOnStateChange((code, state) => {
    publishPublic(code, toPublicView(state))
  })
}
