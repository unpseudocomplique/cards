import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onDisconnect, onHello } from '../../server/game/DisconnectManager'
import { gameStore } from '../../server/game/GameStore'

const HOST_ID = 'user-host-1'

describe('DisconnectManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    gameStore.resetForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    gameStore.resetForTests()
  })

  it('reclaims human control on hello without changing seat or userId', () => {
    const { code } = gameStore.createTable({
      hostUserId: HOST_ID,
      hostName: 'Alice',
      playerCount: 4,
      endMode: 'threshold',
      endValue: 1000,
    })

    onDisconnect(code, HOST_ID)

    let state = gameStore.get(code)!
    expect(state.seats[0]).toMatchObject({
      userId: HOST_ID,
      seatId: 0,
      connected: false,
      controlledBy: 'human',
    })

    vi.advanceTimersByTime(8_000)

    state = gameStore.get(code)!
    expect(state.seats[0]).toMatchObject({
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
    expect(gameStore.get(code)?.seats[0]).toEqual(hello.state.seats[0])
  })

  it('cancels bot takeover when user reconnects within grace period', () => {
    const { code } = gameStore.createTable({
      hostUserId: HOST_ID,
      hostName: 'Alice',
      playerCount: 4,
      endMode: 'threshold',
      endValue: 1000,
    })

    onDisconnect(code, HOST_ID)
    vi.advanceTimersByTime(4_000)

    const hello = onHello(code, HOST_ID)
    expect(hello.ok).toBe(true)

    vi.advanceTimersByTime(8_000)

    const state = gameStore.get(code)!
    expect(state.seats[0]).toMatchObject({
      userId: HOST_ID,
      connected: true,
      controlledBy: 'human',
    })
  })
})
