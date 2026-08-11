# Tarot Game Engine (Cycle 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable French Tarot (FFT 3/4/5) multiplayer game with server-authoritative rules, Yjs public sync, bots, seat reclaim, and a simple 2D Nuxt UI.

**Architecture:** Pure deterministic engine in `shared/tarot/` applied only on the server; clients send intents over Nitro WebSocket and receive private hands; server writes public snapshots to a Yjs room `tarot-{code}`; bots and disconnect reclaim run in `server/game/`.

**Tech Stack:** Nuxt 4, Nitro WebSocket (`defineWebSocketHandler`), Yjs + y-websocket, Vitest, Zod, nuxt-auth-utils, Nuxt UI.

**Spec:** [`docs/superpowers/specs/2026-08-11-tarot-game-engine-design.md`](../specs/2026-08-11-tarot-game-engine-design.md)

## Global Constraints

- Player counts cycle 1: `3 | 4 | 5` only (FFT).
- End modes: `threshold` (default value `1000`) or `deals` (N donnes), set at table create.
- Clients never write game state into Yjs (awareness only).
- Card ids reuse existing catalog codes: `hearts-k`, `trump-21`, `excuse`, etc. (`server/utils/cardCatalog.ts` for tarot78).
- Auth Google required for human seats; bots use ids `bot:1`…
- French UI copy for player-facing strings.
- No TresJS / avatars / 6–8 in this plan.
- TDD for engine modules; commit after each task.

---

## File map

| Path | Responsibility |
|------|----------------|
| `shared/tarot/types.ts` | CardId, phases, GameState, intents, views, errors |
| `shared/tarot/deck.ts` | Build 78-card deck, point values, oudler helpers |
| `shared/tarot/deal.ts` | Shuffle + deal for 3/4/5, petit-sec check |
| `shared/tarot/bid.ts` | Bid ordering, apply bid, all-pass |
| `shared/tarot/ecart.ts` | Dog merge + discard validation |
| `shared/tarot/legalMoves.ts` | Follow / trump / excuse legal set |
| `shared/tarot/trick.ts` | Play card, resolve trick, excuse exchange hooks |
| `shared/tarot/score.ts` | Card points, thresholds, primes, settlement |
| `shared/tarot/botPolicy.ts` | Choose legal intent for bots |
| `shared/tarot/apply.ts` | `apply(state, intent, actor)` FSM entry |
| `shared/tarot/publicView.ts` | Strip secrets → PublicGameView |
| `shared/tarot/index.ts` | Re-exports |
| `server/game/GameStore.ts` | In-memory rooms, apply + side effects |
| `server/game/BotRunner.ts` | Timers when seat controlled by bot |
| `server/game/DisconnectManager.ts` | Grace → bot control; reclaim on hello |
| `server/game/yjsPublisher.ts` | Server Yjs client writes public map |
| `server/api/game/create.post.ts` | Create table + code |
| `server/routes/game/ws.ts` | Nitro WS intents + private push |
| `app/composables/useTarotGame.ts` | Client WS + Yjs read + UI state |
| `app/pages/play/index.vue` | Create form |
| `app/pages/play/[code].vue` | Lobby + table |
| `app/components/play/*` | SeatList, BidPanel, Hand, TrickArea, ScoreBanner |
| `tests/tarot/*.test.ts` | Engine unit tests |
| `vitest.config.ts` | Vitest for `shared/` + `tests/` |
| `package.json` | Scripts + deps: `vitest`, `yjs`, `y-websocket` |

---

### Task 1: Vitest + card deck helpers

**Files:**
- Create: `vitest.config.ts`
- Create: `shared/tarot/types.ts`
- Create: `shared/tarot/deck.ts`
- Create: `tests/tarot/deck.test.ts`
- Modify: `package.json` (scripts + vitest)

**Interfaces:**
- Produces: `CardId` string brand; `buildTarot78Deck(): CardId[]` (78 ids); `cardPoints(card: CardId): number`; `isOudler(card: CardId): boolean`; `isTrump(card: CardId): boolean`; `cardSuit(card: CardId): 'hearts'|'diamonds'|'clubs'|'spades'|'trumps'|null`

- [ ] **Step 1: Add vitest dependency and script**

```bash
cd /home/zeus/cards && pnpm add -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  },
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '~/': fileURLToPath(new URL('./app/', import.meta.url))
    }
  }
})
```

- [ ] **Step 3: Write failing test**

```ts
// tests/tarot/deck.test.ts
import { describe, expect, it } from 'vitest'
import { buildTarot78Deck, cardPoints, isOudler } from '../../shared/tarot/deck'

describe('deck', () => {
  it('has 78 unique cards', () => {
    const deck = buildTarot78Deck()
    expect(deck).toHaveLength(78)
    expect(new Set(deck).size).toBe(78)
  })

  it('scores oudlers and kings at 4.5', () => {
    expect(cardPoints('trump-21')).toBe(4.5)
    expect(cardPoints('trump-1')).toBe(4.5)
    expect(cardPoints('excuse')).toBe(4.5)
    expect(cardPoints('hearts-k')).toBe(4.5)
    expect(isOudler('excuse')).toBe(true)
  })
})
```

- [ ] **Step 4: Run test — expect FAIL**

Run: `pnpm test tests/tarot/deck.test.ts`  
Expected: FAIL module not found

- [ ] **Step 5: Implement `types.ts` + `deck.ts`**

Use card codes aligned with `cardCatalog` tarot78: suits `hearts|diamonds|clubs|spades` ranks `1..10|j|c|q|k`; trumps `trump-1`…`trump-21`; `excuse`.

Point table (half-points): oudler/king 4.5, queen 3.5, knight 2.5, jack 1.5, else 0.5.

- [ ] **Step 6: Run tests — expect PASS**

Run: `pnpm test tests/tarot/deck.test.ts`

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts shared/tarot/types.ts shared/tarot/deck.ts tests/tarot/deck.test.ts
git commit -m "$(cat <<'EOF'
feat(tarot): add deck helpers and vitest

EOF
)"
```

---

### Task 2: Deal + petit sec

**Files:**
- Create: `shared/tarot/deal.ts`
- Create: `tests/tarot/deal.test.ts`
- Modify: `shared/tarot/types.ts` (SeatId, deal result types)

**Interfaces:**
- Consumes: `buildTarot78Deck`, deck helpers
- Produces: `dealHands(playerCount: 3|4|5, rng: () => number): { hands: CardId[][]; chien: CardId[]; petitSecSeats: number[] }`  
  Sizes: 3→24+6, 4→18+6, 5→15+3. Packets 4 (3p) or 3 (4/5p). Never put first/last deck card into chien. `petitSecSeats`: seats whose only trump is Petit and no Excuse.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { dealHands } from '../../shared/tarot/deal'

const fixedRng = (() => {
  let i = 0
  return () => {
    i += 1
    return (i % 1000) / 1000
  }
})()

describe('dealHands', () => {
  it('deals 4p as 18/18/18/18 + chien 6', () => {
    const r = dealHands(4, fixedRng)
    expect(r.hands.every(h => h.length === 18)).toBe(true)
    expect(r.chien).toHaveLength(6)
    const all = [...r.hands.flat(), ...r.chien]
    expect(new Set(all).size).toBe(78)
  })

  it('deals 3p as 24 each + chien 6', () => {
    const r = dealHands(3, fixedRng)
    expect(r.hands.every(h => h.length === 24)).toBe(true)
    expect(r.chien).toHaveLength(6)
  })

  it('deals 5p as 15 each + chien 3', () => {
    const r = dealHands(5, fixedRng)
    expect(r.hands.every(h => h.length === 15)).toBe(true)
    expect(r.chien).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test tests/tarot/deal.test.ts`

- [ ] **Step 3: Implement Fisher–Yates shuffle + packet deal with chien insertion**

Enforce: chien cards picked one-by-one during deal; indices 0 and 77 of shuffled deck never go to chien.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add shared/tarot/deal.ts shared/tarot/types.ts tests/tarot/deal.test.ts
git commit -m "$(cat <<'EOF'
feat(tarot): implement FFT deal for 3/4/5

EOF
)"
```

---

### Task 3: Bidding

**Files:**
- Create: `shared/tarot/bid.ts`
- Create: `tests/tarot/bid.test.ts`

**Interfaces:**
- Produces:  
  `Contract = 'prise' | 'garde' | 'garde_sans' | 'garde_contre'`  
  `BID_RANK: Record<Contract, number>` (1..4)  
  `applyBid(state, seat, bid: Contract | 'passe'): BidResult`  
  After full round: either `{ type: 'all_pass' }` or `{ type: 'won', seat, contract }`.

- [ ] **Step 1: Failing tests** — overcall required; four passes → all_pass; prise then garde wins; each seat speaks once.

- [ ] **Step 2: Implement + pass tests**

- [ ] **Step 3: Commit** `feat(tarot): add bidding round logic`

---

### Task 4: Écart validation

**Files:**
- Create: `shared/tarot/ecart.ts`
- Create: `tests/tarot/ecart.test.ts`

**Interfaces:**
- Produces: `mergeChienIntoHand(hand, chien): CardId[]`  
  `validateEcart(hand, discard: CardId[], chienSize: 6|3): { ok: true } | { ok: false; reason: string }`  
  Rules: discard length = chienSize; cannot discard kings or oudlers; trump discard only if no legal alternative among non-trump non-king; return which discarded trumps must be shown.

- [ ] **Step 1–4:** TDD as above; commit `feat(tarot): validate chien ecart`

---

### Task 5: Legal moves + trick resolution

**Files:**
- Create: `shared/tarot/legalMoves.ts`
- Create: `shared/tarot/trick.ts`
- Create: `tests/tarot/legalMoves.test.ts`
- Create: `tests/tarot/trick.test.ts`

**Interfaces:**
- Produces:  
  `legalMoves(hand: CardId[], trickCards: { seat: number; card: CardId }[], ledSuit: ReturnType<typeof cardSuit> | null): CardId[]`  
  Excuse always legal. Follow suit if able; else must trump if able; overtrump rules when trump already in trick / trump led.  
  `resolveTrick(cards): { winnerSeat: number }` — highest trump wins else highest of led suit (rank order: K>Q>C>J>10>…>1 for suits; 21>…>1 for trumps). Excuse never wins (except document chelem edge in trick module comments; implement last-trick excuse camp change in score/trick bookkeeping).

- [ ] **Step 1: Tests for follow, void→trump, overtrump, excuse lead (second card sets suit)**

- [ ] **Step 2: Implement legalMoves + resolveTrick**

- [ ] **Step 3: Pass tests + commit** `feat(tarot): legal moves and trick winner`

---

### Task 6: Scoring + settlement

**Files:**
- Create: `shared/tarot/score.ts`
- Create: `tests/tarot/score.test.ts`

**Interfaces:**
- Produces:  
  `countCardPoints(cards: CardId[]): number` (pair method → 91 total deck)  
  `requiredPoints(oudlerCount: 0|1|2|3): 56|51|41|36`  
  `computeDealScore(input: {  
    playerCount: 3|4|5  
    contract: Contract  
    takerSeat: number  
    partnerSeat?: number  
    takerCards: CardId[]  // includes ecart / chien per contract rules  
    defenseCards: CardId[]  
    poigneePrime?: number  // 20|30|40 not multiplied  
    petitAuBoutCamp?: 'attack'|'defense'  
    chelem?: 'announced_made'|'unannounced_made'|'announced_failed'|'defense'  
  }): Record<number, number>` // seat → delta, sum 0

  Multipliers: prise×1, garde×2, garde_sans×4, garde_contre×6.  
  Base: `±(25 + |diff|) * mult` then primes.  
  4p: each defender `±S`, taker `∓3S` with sign from success.  
  3p: defenders `±S`, taker `∓2S`.  
  5p: with partner: taker 2 shares, partner 1, each of 3 defenders −1 (scaled by S); alone vs 4 if called own king.

- [ ] **Step 1: Tests** — sample from FFT docs (e.g. garde +8 with 2 bouts → unit math); zero-sum asserts; poignée not multiplied; petit au bout × contract.

- [ ] **Step 2: Implement + pass**

- [ ] **Step 3: Commit** `feat(tarot): FFT deal scoring settlement`

---

### Task 7: FSM `apply()` + publicView

**Files:**
- Create: `shared/tarot/apply.ts`
- Create: `shared/tarot/publicView.ts`
- Create: `shared/tarot/createGame.ts` — `createEmptyGame(config): GameState`
- Create: `shared/tarot/index.ts`
- Create: `tests/tarot/apply.test.ts`

**Interfaces:**
- Produces:  
  ```ts
  type Actor = { userId: string; seat?: number }
  type ApplyResult =
    | { ok: true; state: GameState; events: GameEvent[] }
    | { ok: false; error: 'ILLEGAL_MOVE'|'WRONG_PHASE'|'NOT_YOUR_TURN'|'TABLE_FULL'|'UNAUTHORIZED'|'UNKNOWN_TABLE'; reason: string }

  function apply(state: GameState, intent: Intent, actor: Actor): ApplyResult
  function toPublicView(state: GameState): PublicGameView
  function toPrivateView(state: GameState, seat: number): PrivateGameView
  ```

  Intents (discriminated union): `join`, `addBot`, `removeBot`, `start`, `bid`, `callKing`, `discard`, `announcePoignee`, `announceChelem`, `playCard`, `leave`.

  `start` requires all seats filled; deals; if petitSec → redeal loop (cap 10); enters Bidding.  
  After scoring: if threshold met by any seat OR `dealIndex >= endValue` for deals mode → `MatchOver`; else rotate dealer, `Dealing`.

- [ ] **Step 1: Integration-style unit test** — 4 seats bots in state, `start` → bid all pass → redeal; force bids via direct state setup → play legal card path smoke (can stub mid-state).

- [ ] **Step 2: Implement FSM wiring all modules**

- [ ] **Step 3: Pass + commit** `feat(tarot): wire authoritative apply FSM`

---

### Task 8: Bot policy

**Files:**
- Create: `shared/tarot/botPolicy.ts`
- Create: `tests/tarot/botPolicy.test.ts`

**Interfaces:**
- Produces: `chooseBotIntent(state: GameState, seat: number): Intent`  
  Must only return intents legal for that seat/phase. Bidding: pass unless ≥4 trumps including ≥1 oudler → `prise`. Play: prefer lowest legal card that follows suit; else first legal.

- [ ] **Step 1–4:** TDD — for random states with legalMoves, chosen playCard card ∈ legalMoves; commit `feat(tarot): add legal bot policy`

---

### Task 9: GameStore + create API + DisconnectManager + BotRunner

**Files:**
- Create: `server/game/GameStore.ts`
- Create: `server/game/BotRunner.ts`
- Create: `server/game/DisconnectManager.ts`
- Create: `server/api/game/create.post.ts`
- Create: `server/api/game/[code]/get.ts` — public lobby peek (no secrets)

**Interfaces:**
- Produces:  
  ```ts
  // GameStore
  createTable(opts: { hostUserId: string; hostName: string; playerCount: 3|4|5; endMode: 'threshold'|'deals'; endValue: number }): { code: string }
  get(code: string): GameState | undefined
  applyIntent(code: string, intent: Intent, actor: Actor): ApplyResult
  setPeer(code: string, userId: string, peer: PeerHandle): void
  // DisconnectManager
  onDisconnect(code: string, userId: string): void  // 8s grace then controlledBy='bot'
  onHello(code: string, userId: string): ApplyResult // reclaim seat controlledBy='human'
  // BotRunner
  scheduleIfBotTurn(code: string): void  // 400-800ms then applyIntent(botPolicy)
  ```

- [ ] **Step 1: Implement in-memory `Map<code, Room>`** where Room holds `state`, peer map, bot timers, disconnect timers.

- [ ] **Step 2: `create.post.ts`** body zod:

```ts
z.object({
  playerCount: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  endMode: z.enum(['threshold', 'deals']).default('threshold'),
  endValue: z.number().int().positive().default(1000)
})
```

Require `requireUserSession(event)`; return `{ code, inviteUrl: `${siteUrl}/play/${code}` }`.

- [ ] **Step 3: After every successful apply** — call `BotRunner.scheduleIfBotTurn`; notify peers (wired in Task 10).

- [ ] **Step 4: Commit** `feat(tarot): add GameStore create API and bot reclaim`

---

### Task 10: Nitro WS + Yjs publisher

**Files:**
- Create: `server/game/yjsPublisher.ts`
- Create: `server/routes/game/ws.ts`
- Modify: `nuxt.config.ts` — `nitro.experimental.websocket: true`; `runtimeConfig.public.yjsWebsocketUrl`
- Modify: `.env.example` — `NUXT_PUBLIC_YJS_WEBSOCKET_URL=ws://localhost:1234`
- Modify: `package.json` — `pnpm add yjs y-websocket`

**Interfaces:**
- Produces: `publishPublic(code: string, view: PublicGameView): void`  
  WS messages:  
  Client→Server: `{ type:'hello'|'intent', intent?: Intent }`  
  Server→Client: `{ type:'private'|'error'|'applied', private?: PrivateGameView, error?: ..., publicVersion?: number }`

- [ ] **Step 1: Enable Nitro websocket in `nuxt.config.ts`**

```ts
nitro: {
  experimental: { websocket: true },
  // keep existing serverAssets/prerender
}
```

- [ ] **Step 2: `yjsPublisher.ts`** — singleton WebsocketProvider as server client per room (or one provider multiplexing). On publish: `ydoc.getMap('public').set('snapshot', view)` and `set('version', view.version)` inside `transact`.

- [ ] **Step 3: `ws.ts`** — on upgrade load session; on message hello/intent call GameStore; send private view to actor; publish public; on close DisconnectManager.onDisconnect.

- [ ] **Step 4: Document local y-websocket**: run `npx y-websocket` (or docker) on 1234 for dev. Add short note under `docs/superpowers/specs/` only if needed — prefer README snippet in commit body / comment in `.env.example`.

- [ ] **Step 5: Commit** `feat(tarot): wire game WS and Yjs publisher`

---

### Task 11: Client composable `useTarotGame`

**Files:**
- Create: `app/composables/useTarotGame.ts`

**Interfaces:**
- Produces:  
  ```ts
  function useTarotGame(code: Ref<string> | string): {
    publicState: Ref<PublicGameView | null>
    privateState: Ref<PrivateGameView | null>
    connected: Ref<boolean>
    error: Ref<string | null>
    sendIntent: (intent: Intent) => void
    awarenessUsers: Ref<Array<{ userId: string; name: string; seat?: number }>>
  }
  ```

  Opens WS to `/game/ws?code=`; opens Y.Doc WebsocketProvider to `yjsWebsocketUrl` room `tarot-${code}` read-only for public map; sets awareness local state from session user.

- [ ] **Step 1: Implement composable with onMounted/onUnmounted cleanup** (provider.destroy, ws.close).

- [ ] **Step 2: Manual smoke in browser after Task 12** (no component test required).

- [ ] **Step 3: Commit** `feat(tarot): add useTarotGame composable`

---

### Task 12: Play UI pages + components

**Files:**
- Create: `app/pages/play/index.vue`
- Create: `app/pages/play/[code].vue`
- Create: `app/components/play/SeatList.vue`
- Create: `app/components/play/BidPanel.vue`
- Create: `app/components/play/HandCards.vue`
- Create: `app/components/play/TrickArea.vue`
- Create: `app/components/play/ScoreBanner.vue`
- Create: `app/components/play/CardFace.vue` — placeholder CSS from card id
- Modify: `app/pages/index.vue` or dashboard — link « Jouer au tarot » → `/play` (minimal)

**Interfaces:**
- Consumes: `useTarotGame`, create API
- Produces: Working lobby + table UX per spec §UI

- [ ] **Step 1: `/play/index.vue`** — form playerCount, endMode, endValue; POST `/api/game/create`; navigate to `/play/${code}`. Redirect login if no session.

- [ ] **Step 2: `/play/[code].vue`** — if phase Lobby show SeatList + host controls (addBot, start); else show ScoreBanner + TrickArea + HandCards + BidPanel when Bidding / DogEcarta panels.

- [ ] **Step 3: HandCards** — only emit play for ids in `privateState.legalMoves`; disabled styling otherwise.

- [ ] **Step 4: CardFace** — show shortLabel / suit color (♥♦ red, ♣♠ black, trumps gold).

- [ ] **Step 5: Manual verify** — 4 bots not possible alone: host + 3 bots, start, complete bids with bot help, play one hand.

- [ ] **Step 6: Commit** `feat(tarot): add play lobby and 2D table UI`

---

### Task 13: Reclaim + match-end hardening + browser smoke

**Files:**
- Modify: `server/game/DisconnectManager.ts` (tune grace 8s)
- Create: `tests/tarot/reclaim.test.ts` — pure state flag flip helper if extracted; or GameStore unit with fake timers
- Modify: engine if match-end bugs found

- [ ] **Step 1: Test** — seat `controlledBy` flips bot→human on `onHello` without changing `userId`/`seat` index.

- [ ] **Step 2: Vitest fake timers for BotRunner** — bot schedules play within 1s when human disconnected.

- [ ] **Step 3: Browser smoke checklist**
  1. Login → `/play` → create 4p threshold 1000  
  2. Copy invite (optional 2nd browser) or add 3 bots  
  3. Start → bots bid/play through scoring  
  4. DevTools: Yjs/public has no full hands array of all players  
  5. Kill network on one client → bot takes seat → reconnect → human reclaim  

- [ ] **Step 4: Commit** `test(tarot): cover seat reclaim and smoke fixes`

---

### Task 14: Plan self-check + README pointer

**Files:**
- Modify: `README.md` — short « Jeu de tarot » section: deps (`pnpm test`, y-websocket port 1234, `/play`)

- [ ] **Step 1: Verify all spec done criteria mapped** (see Self-Review below)

- [ ] **Step 2: Commit** `docs: note tarot play setup in README`

---

## Self-Review (author)

| Spec requirement | Task |
|------------------|------|
| FFT 3/4/5 deal, bid, écart, tricks, excuse, poignée, chelem, scoring | 2–7 |
| Server authoritative + private hands | 9–10 |
| Yjs public only | 10–11 |
| Invite link + bots | 9, 12 |
| End 1000 or N deals | 7, 9, 12 |
| Reclaim seat from bot realtime | 9, 13 |
| UI 2D play pages | 12 |
| Vitest engine | 1–8, 13 |
| No 3D / 6–8 / friends | Global constraints |

Placeholder scan: none intentional.  
Type names aligned: `Contract`, `Intent`, `GameState`, `PublicGameView`, `PrivateGameView`, `apply`, `controlledBy`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-11-tarot-game-engine.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session with executing-plans, batched checkpoints  

Which approach?
