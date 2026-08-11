import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scheduleIfBotTurn } from '../../server/game/BotRunner'
import { onDisconnect, onHello } from '../../server/game/DisconnectManager'
import { gameStore } from '../../server/game/GameStore'

const HOST_ID = 'user-host-1'

describe('seat reclaim', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    gameStore.resetForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    gameStore.resetForTests()
  })

  it('sets controlledBy=bot after disconnect grace, then human on hello with same seat/userId', () => {
    const { code } = gameStore.createTable({
      hostUserId: HOST_ID,
      hostName: 'Alice',
      playerCount: 4,
      endMode: 'threshold',
      endValue: 1000,
    })

    onDisconnect(code, HOST_ID)

    expect(gameStore.get(code)!.seats[0]).toMatchObject({
      userId: HOST_ID,
      seatId: 0,
      connected: false,
      controlledBy: 'human',
    })

    vi.advanceTimersByTime(8_000)

    expect(gameStore.get(code)!.seats[0]).toMatchObject({
      userId: HOST_ID,
      seatId: 0,
      connected: false,
      controlledBy: 'bot',
    })

    const hello = onHello(code, HOST_ID)
    expect(hello.ok).toBe(true)
    if (!hello.ok) {
      return
    }

    expect(hello.state.seats[0]).toMatchObject({
      userId: HOST_ID,
      seatId: 0,
      connected: true,
      controlledBy: 'human',
    })
  })

  it('cancels pending bot timer when human reclaims after bot takeover', () => {
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

    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(800)
    }

    expect(gameStore.get(code)!.currentSeat).toBe(0)

    onDisconnect(code, HOST_ID)
    vi.advanceTimersByTime(8_000)

    const afterGrace = gameStore.get(code)!
    expect(afterGrace.seats[0]?.controlledBy).toBe('bot')
    expect(afterGrace.currentSeat).toBe(0)

    scheduleIfBotTurn(code)
    expect(gameStore.getRoom(code)?.botTimer).not.toBeNull()

    const beforeBidCount = gameStore.get(code)!.bidSpoken.length

    const hello = onHello(code, HOST_ID)
    expect(hello.ok).toBe(true)
    expect(gameStore.getRoom(code)?.botTimer).toBeNull()
    expect(gameStore.get(code)!.seats[0]?.controlledBy).toBe('human')

    vi.advanceTimersByTime(800)

    expect(gameStore.get(code)!.bidSpoken.length).toBe(beforeBidCount)
  })
})
