import type { GameConfig, GameState, SeatInfo } from './types'

function emptySeat(seatId: number): SeatInfo {
  return {
    seatId,
    userId: null,
    name: '',
    connected: false,
    controlledBy: 'human',
  }
}

export function createEmptyGame(config: GameConfig): GameState {
  const seats: SeatInfo[] = Array.from({ length: config.playerCount }, (_, seatId) => {
    if (seatId === 0) {
      return {
        seatId: 0,
        userId: config.hostUserId,
        name: config.hostName ?? 'Host',
        connected: true,
        controlledBy: 'human',
      }
    }
    return emptySeat(seatId)
  })

  return {
    phase: 'Lobby',
    playerCount: config.playerCount,
    endMode: config.endMode,
    endValue: config.endValue,
    code: config.code,
    deckId: config.deckId,
    version: 0,
    dealerSeat: 0,
    currentSeat: 0,
    seats,
    hands: Array.from({ length: config.playerCount }, () => []),
    chien: [],
    ecart: [],
    bidState: null,
    bid: null,
    bidSpoken: [],
    trick: [],
    pilesAttack: [],
    pilesDefense: [],
    scores: Array.from({ length: config.playerCount }, () => 0),
    dealIndex: 0,
    attackTricks: 0,
    defenseTricks: 0,
    hostUserId: config.hostUserId,
    rngCounter: 0,
  }
}
