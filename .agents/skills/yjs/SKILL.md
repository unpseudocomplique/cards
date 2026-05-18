---
name: yjs
description: >-
  Yjs CRDT patterns for Quizwar real-time game sync. Use when working with Yjs, Y.Doc, Y.Map,
  Y.Array, CRDTs, useGameSync composable, WebsocketProvider, real-time synchronization, game
  state sync, awareness/presence, clock sync, or any collaborative/multiplayer game state logic.
argument-hint: "[composable/pattern] Describe what you need help with"
---

# Yjs Skill — Quizwar Real-Time Game Sync

## Quizwar Yjs Architecture

Quizwar uses **Yjs + y-websocket** to synchronize game state in real time between all players.

### Infrastructure

- **y-websocket server** runs as a separate service (Docker, port 1234)
- **WebSocket URL** configured via `YJS_WEBSOCKET_URL` env var (`runtimeConfig.public.yjsWebsocketUrl`)
- Each game room is a Y.Doc identified by `game-${gameCode}`

### Core Composable: `useGameSync`

Located at `app/composables/useGameSync.ts`. This is the **only** place where Yjs types are used in the app — all game components consume the typed reactive `syncedState` ref.

```typescript
const gameSync = useGameSync(gameCode, odPlayerId, isHost)
```

Returns:
- `syncedState` — reactive `SyncedGameState` (read by all components)
- `connected` — WebSocket connection status
- `connectedUsers` — awareness presence map
- Host methods: `startPhase()`, `setPhase()`, `setCurrentQuestionIndex()`, `resetForNewQuestion()`, etc.
- Presentator methods: `setPresentatorMode()`, `pauseGame()`, `resumeGame()`, `sendEffect()`
- Player methods: `submitAnswer()`, `addPower()`

### Shared Types Layout (Y.Doc structure)

```
Y.Doc (room: "game-{code}")
├── Y.Map("gameState")     → phase, currentQuestionIndex, phaseStartTime, phaseDuration,
│                             eliminatedAnswers, hostId, version, isPresentatorMode,
│                             isPaused, pausedTimeRemaining, playerVersion, kickedPlayers
├── Y.Map("answers")       → keyed by odPlayerId → { odId, answerIds, answeredAt }
├── Y.Array("powers")      → [{ odPlayerId, power, targetId?, usedAt }]
└── Y.Array("effects")     → [{ id, type, content, targetPlayerId?, timestamp, duration }]
```

### Key Patterns Used in Quizwar

#### 1. Always use `transact()` for batch updates
Every state mutation wraps related changes in a single transaction to ensure atomic sync:

```typescript
ydoc.value.transact(() => {
  yGameState.value!.set('phase', phase)
  yGameState.value!.set('phaseStartTime', now)
  yGameState.value!.set('phaseDuration', durationSeconds * 1000)
  yGameState.value!.set('version', (yGameState.value!.get('version') || 0) + 1)
})
```

#### 2. Version counter for change detection
The `version` field is incremented on every significant state change, enabling components to detect meaningful updates vs. noise.

#### 3. Player-keyed answers (single-writer pattern)
Each player writes to their own key in `yAnswers`, avoiding conflicts:

```typescript
yAnswers.value!.set(odPlayerId, {
  odId: odPlayerId,
  answerIds,
  answeredAt: getServerTime()
})
```

#### 4. Clock synchronization
Server time is used for all timestamps (phaseStartTime, answeredAt, usedAt). The composable syncs clocks using median-offset sampling against `/api/ping`:

```typescript
const getServerTime = (): number => Date.now() - clockSync.value.offset
```

- Initial sync: 5 samples
- Reconnect sync: 3 samples
- Periodic sync: every 30s with 3 samples

#### 5. Awareness for presence
Player presence (online/offline) is tracked via Yjs awareness:

```typescript
awareness.value.setLocalState({
  odId: odPlayerId,
  isHost,
  online: true,
  joinedAt: getServerTime()
})
```

#### 6. Host initializes state
Only the host writes initial state when the Y.Map is empty:

```typescript
if (isHost && yGameState.value.size === 0) {
  initializeHostState()
}
```

#### 7. Disconnect safety
A `isDisconnected` flag prevents operations after unmount. Always check before async operations:

```typescript
if (isDisconnected) return
```

#### 8. Reset between questions
`resetForNewQuestion()` clears answers, powers, effects, and eliminated answers in one transaction.

### Phase Transition Pattern

```typescript
// Host starts timed phase (countdown 3s, hint 8s, answering N s)
gameSync.startPhase('countdown', 3)

// Host sets untimed phase (lobby, results, finished)
gameSync.setPhase('results')
```

Phase data stored: `phase` + `phaseStartTime` (server time) + `phaseDuration` (ms). Clients compute remaining time locally using synced clock.

### Adding New Synced State

When adding new fields to the game sync:

1. Add the field to `SyncedGameState` interface
2. Initialize it in `initializeHostState()` inside a `transact()`
3. Read it in `syncFromYjs()` with a sensible default: `yGameState.value.get('newField') || defaultValue`
4. Add a setter method that uses `transact()` and increments `version`
5. Expose via the composable's return object

### Common Pitfalls in This Project

- **Don't access Y types directly from components** — always go through `useGameSync`
- **Don't forget `transact()`** — ungrouped writes cause multiple sync events
- **Don't use `Date.now()` for timestamps** — use `getServerTime()` for cross-client consistency
- **Don't mutate `syncedState` directly** — it's derived from Yjs observers
- **Check `isDisconnected` in async callbacks** — the composable may be unmounted

---

## General Yjs Reference

### Shared Types

Yjs provides three main shared types:

- `Y.Map` — Key-value pairs (like JavaScript Map)
- `Y.Array` — Ordered lists (like JavaScript Array)
- `Y.Text` — Rich text with formatting

### Client ID & Conflict Resolution

Every Y.Doc gets a random `clientID`. When two clients write to the same key simultaneously, the **higher clientID wins** (not the later timestamp).

```typescript
const doc = new Y.Doc()
console.log(doc.clientID) // Random number
```

This is deterministic — all clients converge to the same state.

### Single-Writer Keys

**Problem**: Multiple writers updating the same key causes lost writes.

```typescript
// BAD: Both clients read 5, both write 6 — one click lost
const count = ymap.get('count') || 0
ymap.set('count', count + 1)
```

**Solution**: Partition by clientID or player ID. Each writer owns their key.

```typescript
// GOOD: Each client writes to their own key
ymap.set(odPlayerId, { answerIds, answeredAt: getServerTime() })

// Sum all values when reading
function getCount(ymap) {
  let sum = 0
  for (const value of ymap.values()) sum += value
  return sum
}
```

### Shared Types Cannot Move

Once a shared type is added to a document, it cannot be moved. "Moving" an item in an array = delete + insert. Yjs doesn't know these are related.

### Nested Structures for Conflict Avoidance

Store each property as a separate Y.Map key to avoid conflicts between independent property updates.

```typescript
// BAD: Any property change conflicts with any other
ymap.set('config', { a: 1, b: 2, c: 3 })

// GOOD: Independent keys
ymap.set('a', 1)
ymap.set('b', 2)
ymap.set('c', 3)
```

### Y.Map Tombstone Awareness

Every `ymap.set(key, value)` creates a new internal item and tombstones the previous one. For bounded keys that change infrequently (like game config), this is fine. For high-churn data, consider `YKeyValue` from `y-utility`.

### Epoch-Based Compaction

Re-encode to strip history:

```typescript
const snapshot = Y.encodeStateAsUpdate(doc)
const freshDoc = new Y.Doc({ guid: doc.guid })
Y.applyUpdate(freshDoc, snapshot)
```

### Common Mistakes

1. **Assuming "last write wins" means timestamps** — higher clientID wins
2. **Orphan Y types** — always attach to a document (`doc.getMap('name')`)
3. **Storing non-serializable values** — Y types store JSON-serializable data only
4. **Expecting moves to preserve identity** — delete + insert creates a new item
5. **Leaking raw Y types outside the owning module** — keep behind typed APIs (Quizwar does this correctly with `useGameSync`)

### Debugging

```typescript
console.log(doc.toJSON())          // Full document as plain JSON
console.log('My ID:', doc.clientID) // Check conflict winner
```

## References

- [Yjs Documentation](https://docs.yjs.dev/)
- [Learn Yjs](https://learn.yjs.dev/)
- [Yjs INTERNALS.md](https://github.com/yjs/yjs/blob/main/INTERNALS.md)
- [y-websocket](https://github.com/yjs/y-websocket)
- [Quizwar useGameSync](../../../app/composables/useGameSync.ts)
