import type { GameState } from '~~/shared/tarot'

export interface PeerHandle {
  send(data: unknown): void
}

export type Room = {
  /** Unique id of this table's match (statistics). */
  matchId: string
  state: GameState
  peers: Map<string, PeerHandle>
  botTimer: ReturnType<typeof setTimeout> | null
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>
}
