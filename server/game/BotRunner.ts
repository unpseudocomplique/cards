import { gameStore } from './GameStore'

export function scheduleIfBotTurn(code: string): void {
  gameStore.scheduleIfBotTurn(code)
}
