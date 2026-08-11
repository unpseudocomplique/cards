import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { toPublicView } from '~~/shared/tarot'
import type { PublicGameView } from '~~/shared/tarot'
import { gameStore } from './GameStore'

type RoomConnection = {
  doc: Y.Doc
  provider: WebsocketProvider
}

const rooms = new Map<string, RoomConnection>()

function roomName(code: string): string {
  return `tarot-${code}`
}

function getConnection(code: string): RoomConnection {
  let connection = rooms.get(code)
  if (!connection) {
    const config = useRuntimeConfig()
    const serverUrl = String(config.public.yjsWebsocketUrl)
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
  const { doc } = getConnection(code)
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

gameStore.setOnStateChange((code, state) => {
  publishPublic(code, toPublicView(state))
})
