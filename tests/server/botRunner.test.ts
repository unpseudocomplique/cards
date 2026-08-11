import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scheduleIfBotTurn } from '../../server/game/BotRunner'
import { gameStore } from '../../server/game/GameStore'

const HOST_ID = 'user-host-1'

describe('BotRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    gameStore.resetForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    gameStore.resetForTests()
  })

  it('schedules a bot bid within 400-800ms when a bot seat is active in bidding', () => {
    const { code } = gameStore.createTable({
      hostUserId: HOST_ID,
      hostName: 'Alice',
      playerCount: 4,
      endMode: 'threshold',
      endValue: 1000,
    })

    for (let seat = 1; seat < 4; seat++) {
      gameStore.applyIntent(code, { type: 'addBot' }, { userId: HOST_ID })
    }

    const started = gameStore.applyIntent(code, { type: 'start' }, { userId: HOST_ID })
    expect(started.ok).toBe(true)
    if (!started.ok) {
      return
    }

    const biddingSeat = started.state.currentSeat
    const seatInfo = started.state.seats[biddingSeat]
    expect(seatInfo?.controlledBy).toBe('bot')

    scheduleIfBotTurn(code)

    const beforeBid = gameStore.get(code)!
    expect(beforeBid.bidSpoken).toHaveLength(0)

    vi.advanceTimersByTime(800)

    const afterBid = gameStore.get(code)!
    expect(afterBid.bidSpoken.length).toBeGreaterThan(0)
    expect(afterBid.bidSpoken.some(entry => entry.seat === biddingSeat)).toBe(true)
  })
})
