import type { GameState } from '~~/shared/tarot'

export interface PeerHandle {
  send(data: unknown): void
}

export type Room = {
  state: GameState
  peers: Map<string, PeerHandle>
  botTimer: ReturnType<typeof setTimeout> | null
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>
}
