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
    deckId: 'deck-test',
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

  it('does not schedule bot actions in Lobby or MatchOver', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { code } = gameStore.createTable({
      hostUserId: HOST_ID,
      hostName: 'Alice',
      playerCount: 4,
      endMode: 'threshold',
      endValue: 1000,
      deckId: 'deck-test',
    })

    gameStore.applyIntent(code, { type: 'addBot' }, { userId: HOST_ID })

    // Disconnect grace flips seat 0 to bot while still in Lobby, then schedules bots.
    gameStore.onDisconnect(code, HOST_ID)
    vi.advanceTimersByTime(8_000)
    expect(gameStore.get(code)!.seats[0]?.controlledBy).toBe('bot')
    expect(gameStore.get(code)!.phase).toBe('Lobby')
    vi.advanceTimersByTime(800)
    expect(errorSpy).not.toHaveBeenCalled()

    const room = (gameStore as unknown as {
      rooms: Map<string, { state: NonNullable<ReturnType<typeof gameStore.get>> }>
    }).rooms.get(code)!
    room.state = {
      ...room.state,
      phase: 'MatchOver',
      currentSeat: 1,
    }

    scheduleIfBotTurn(code)
    vi.advanceTimersByTime(800)
    expect(errorSpy).not.toHaveBeenCalled()
    expect(gameStore.get(code)!.phase).toBe('MatchOver')

    errorSpy.mockRestore()
  })
})
