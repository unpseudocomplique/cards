import type { ApplyResult } from '~~/shared/tarot'
import { gameStore } from './GameStore'

export function onDisconnect(code: string, userId: string): void {
  gameStore.onDisconnect(code, userId)
}

export function onHello(code: string, userId: string): ApplyResult {
  return gameStore.onHello(code, userId)
}
