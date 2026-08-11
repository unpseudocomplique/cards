# Tarot Table 3D (Cycle 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2D play table with a full TresJS 3D scene that uses the host’s `tarot78` S3 deck textures, keeps cycle-1 rules/WS/Yjs unchanged, and hits the performance budget (60 fps desktop / ≥30 fps mobile mid).

**Architecture:** TresJS is a **view** over `useTarotGame` public/private state. Server adds `deckId` on create + a seated-player texture manifest. Client builds a shared texture pool (resize ≤512), quality profiles, and a pooled card-mesh scene with DOM HUD overlay.

**Tech Stack:** Nuxt 4, `@tresjs/nuxt` (+ `three`), existing Nitro WS / Yjs / Vitest / Zod / Nuxt UI.

**Spec:** [`docs/superpowers/specs/2026-08-12-tarot-table-3d-design.md`](../specs/2026-08-12-tarot-table-3d-design.md)

**Branch:** create `feat/tarot-table-3d-cycle2` from current cycle-1 branch (or `main` after cycle-1 merge). Prefer branching from `feat/tarot-game-engine-cycle1` until cycle 1 lands.

## Global Constraints

- Full 3D only (no 2D table toggle).
- No Rapier / EffectComposer bloom/SSAO / heavy IBL.
- No engine rule changes except `deckId` on state/views.
- French UI copy for player-facing strings.
- Dispose all WebGL resources on leave.
- Commit after each task.
- TDD for server manifest + create validation; scene smoke is manual + light unit tests for texture helpers.

---

## File map

| Path | Responsibility |
|------|----------------|
| `nuxt.config.ts` | Register `@tresjs/nuxt` |
| `package.json` | `@tresjs/nuxt`, `three`, `@types/three` |
| `shared/tarot/types.ts` | `deckId` on `GameConfig` / `GameState` / `PublicGameView` |
| `shared/tarot/createGame.ts` | Persist `deckId` |
| `shared/tarot/publicView.ts` | Expose `deckId` |
| `server/game/GameStore.ts` | `createTable({ deckId })` |
| `server/api/game/create.post.ts` | Validate owned `tarot78` deck |
| `server/api/game/[code]/deck-textures.get.ts` | Manifest for seated players |
| `server/utils/deckTextures.ts` | Pure helper: rows → manifest |
| `app/pages/play/index.vue` | Deck picker |
| `app/pages/play/[code].vue` | `ClientOnly` + `TableScene` + HUD overlays |
| `app/composables/usePlayQuality.ts` | `high\|medium\|low` + fps downgrade |
| `app/composables/useCardTextures.ts` | Load/resize/pool/dispose textures |
| `app/components/play/tres/TableScene.vue` | `TresCanvas` root |
| `app/components/play/tres/TableFelt.vue` | Felt mesh |
| `app/components/play/tres/CardMesh.vue` | Double-sided card |
| `app/components/play/tres/HandFan.vue` | Local hand + raycast |
| `app/components/play/tres/TrickPile.vue` | Center trick |
| `app/components/play/tres/OpponentStacks.vue` | Back stacks by `handCounts` |
| `app/utils/cardPlaceholderTexture.ts` | Canvas placeholder by `cardCode` |
| `tests/server/deckTextures.test.ts` | Manifest mapping |
| `tests/server/createGameDeck.test.ts` | Create rejects bad deck |
| `README.md` | Note TresJS + deck requirement for `/play` |

---

### Task 1: Branch + TresJS module

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `nuxt.config.ts`
- Create branch `feat/tarot-table-3d-cycle2`

- [ ] **Step 1: Create branch**

```bash
cd /home/zeus/cards && git checkout -b feat/tarot-table-3d-cycle2
```

- [ ] **Step 2: Add TresJS**

```bash
cd /home/zeus/cards && pnpm dlx nuxi@latest module add tresjs
```

If the CLI does not edit config, add manually:

```ts
modules: [
  // ...existing
  '@tresjs/nuxt',
],
```

Ensure `three` is installed (module peer). Add `@types/three` as devDependency if missing.

- [ ] **Step 3: Smoke stub page component (compile only)**

Create temporary `app/components/play/tres/TableScene.vue`:

```vue
<script setup lang="ts">
// Placeholder until Task 5 — empty canvas proves module loads.
</script>

<template>
  <ClientOnly>
    <TresCanvas clear-color="#1a1f16" class="h-full w-full">
      <TresPerspectiveCamera :position="[0, 4.5, 6]" :look-at="[0, 0, 0]" />
      <TresAmbientLight :intensity="0.7" />
      <TresMesh :rotation="[-Math.PI / 2, 0, 0]">
        <TresCircleGeometry :args="[3.2, 48]" />
        <TresMeshStandardMaterial color="#2f5d3a" />
      </TresMesh>
    </TresCanvas>
  </ClientOnly>
</template>
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml nuxt.config.ts app/components/play/tres/TableScene.vue
git commit -m "$(cat <<'EOF'
chore(play): add TresJS module and table scene stub

EOF
)"
```

---

### Task 2: `deckId` on game state + public view

**Files:**
- Modify: `shared/tarot/types.ts`, `createGame.ts`, `publicView.ts`, `server/game/GameStore.ts`
- Modify/create tests as needed in `tests/tarot/` or `tests/server/`

**Interfaces:**
- `GameConfig.deckId: string`
- `GameState.deckId: string`
- `PublicGameView.deckId: string`
- `createTable({ ..., deckId })`

- [ ] **Step 1: Extend types + `createEmptyGame`**

- [ ] **Step 2: Thread through `GameStore.createTable` + `toPublicView`**

- [ ] **Step 3: Unit assert public view includes `deckId`**

```ts
it('exposes deckId in public view', () => {
  const state = createEmptyGame({
    hostUserId: 'h',
    playerCount: 4,
    endMode: 'deals',
    endValue: 1,
    deckId: 'deck-1',
  })
  expect(toPublicView(state).deckId).toBe('deck-1')
})
```

- [ ] **Step 4: Commit** `feat(tarot): persist deckId on table state`

---

### Task 3: Create API validates owned tarot78 deck

**Files:**
- Modify: `server/api/game/create.post.ts`
- Create: `tests/server/createGameDeck.test.ts` (mock db or extract pure validator)

**Behavior:**
- Body requires `deckId: z.string().uuid()` (or text id matching schema).
- Load deck via existing access helper; require `type === 'tarot78'` and ownership.
- 400 otherwise with French message.

- [ ] **Step 1: Failing test** — wrong type / not owned → 400 shape (prefer extracting `assertPlayableTarotDeck(deck)` pure fn if db hard to mock).

- [ ] **Step 2: Implement validation + pass `deckId` to `createTable`.

- [ ] **Step 3: Commit** `feat(tarot): require tarot78 deck on create`

---

### Task 4: Deck texture manifest API

**Files:**
- Create: `server/utils/deckTextures.ts`
- Create: `server/api/game/[code]/deck-textures.get.ts`
- Create: `tests/server/deckTextures.test.ts`

**Interfaces:**

```ts
export type DeckTextureManifest = {
  deckId: string
  backUrl: string | null
  cards: Array<{
    cardCode: string
    faceUrl: string | null
    aspectRatio: '3:4' | '9:16'
  }>
}

export function buildDeckTextureManifest(input: {
  deckId: string
  backUrl: string | null
  cards: Array<{ cardCode: string, finalImageUrl: string | null, aspectRatio?: '3:4' | '9:16' }>
}): DeckTextureManifest
```

- Always emit **78** catalog codes (from `buildTarot78Deck` / cardCatalog), `faceUrl: null` if missing.
- Aspect: trumps + excuse → `9:16`, else `3:4` (use catalog metadata when present).

**Auth:** `requireUserSession`; room exists; actor seated (`userId` in seats) **or** host. Else 403.

- [ ] **Step 1: Unit test `buildDeckTextureManifest`** — partial faces → nulls; back url; 78 entries.

- [ ] **Step 2: Implement GET handler** reading `gameStore.get(code).deckId` + DB cards/settings.

- [ ] **Step 3: Commit** `feat(tarot): add seated deck texture manifest API`

---

### Task 5: Quality profile + texture pool composables

**Files:**
- Create: `app/composables/usePlayQuality.ts`
- Create: `app/composables/useCardTextures.ts`
- Create: `app/utils/cardPlaceholderTexture.ts`
- Create: `tests/tarot/placeholderTexture.test.ts` (node canvas or skip DOM — test pure label/color helpers if canvas unavailable)

**`usePlayQuality`:**
- Detect `high|medium|low` from `hardwareConcurrency`, coarse pointer, WebGL renderer string.
- Expose `{ profile, dprCap, maxTex, shadows, lights, noteFpsSample(fps) }`.
- One-shot downgrade if fps &lt; 25 for 3s.

**`useCardTextures(code)`:**
- `$fetch` manifest from `/api/game/${code}/deck-textures`.
- Concurrency 6; resize via `createImageBitmap` + draw to canvas ≤ `maxTex`.
- Map `cardCode → THREE.Texture`; shared back texture.
- `getFace(cardCode)`, `getBack()`, `disposeAll()`.

- [ ] **Step 1: Implement quality helper + unit test detection thresholds (pure).**

- [ ] **Step 2: Implement placeholder + texture pool (client-only).**

- [ ] **Step 3: Commit** `feat(play): add quality profiles and card texture pool`

---

### Task 6: Core Tres scene (felt, seats, card mesh)

**Files:**
- Replace/expand: `app/components/play/tres/TableScene.vue`
- Create: `TableFelt.vue`, `CardMesh.vue`, `SeatAnchor.vue`

**Behavior:**
- Shared `BoxGeometry` depth ~0.01 (or Plane dual material).
- Props: `publicState`, `privateState`, `textures`, `quality`, `localSeat`.
- Seat anchors at angles for 3/4/5; rotate so `localSeat` is at −Z near camera.
- Ambient + 1 directional (2 on `high` only); no shadows unless `high`.
- `setPixelRatio` from `quality.dprCap`.
- `onUnmounted` → dispose geometries owned by scene helpers + call `textures.disposeAll()`.

- [ ] **Step 1: Felt + lights + camera framing.**

- [ ] **Step 2: `CardMesh` with face/back materials from pool/placeholder.**

- [ ] **Step 3: Commit** `feat(play): build Tres table felt and card mesh`

---

### Task 7: Hand fan, trick pile, opponent stacks + pick

**Files:**
- Create: `HandFan.vue`, `TrickPile.vue`, `OpponentStacks.vue`
- Wire into `TableScene.vue`

**Behavior:**
- `HandFan`: layout `privateState.hand`; emit `play(cardId)` only if in `legalMoves`; raycast pointer.
- `TrickPile`: show `publicState.trick` cards face-up.
- `OpponentStacks`: for each other seat, stack of `handCounts[i]` backs.
- Chien: when `chienRevealed` non-null, small row near center.
- Short tweens (120–280 ms) on add/remove; honor `prefers-reduced-motion`.

- [ ] **Step 1: Opponent stacks + trick (read-only).**

- [ ] **Step 2: Interactive hand + emit play.**

- [ ] **Step 3: Commit** `feat(play): wire hand trick and opponent stacks in 3D`

---

### Task 8: Integrate `/play` pages (replace 2D table)

**Files:**
- Modify: `app/pages/play/index.vue` — load user’s `tarot78` decks (`GET /api/decks`), select `deckId`, POST create.
- Modify: `app/pages/play/[code].vue` — keep lobby + HUD (bid, écart DOM, king call, scoring, banners); replace `PlayTrickArea` / `PlayHandCards` table block with:

```vue
<div class="relative h-[min(70vh,720px)] w-full overflow-hidden rounded-xl">
  <PlayTresTableScene
    v-if="!isLobby && publicState"
    :public-state="publicState"
    :private-state="privateState"
    :code="code"
    @play="sendIntent({ type: 'playCard', card: $event })"
  />
</div>
```

- Keep DOM for Lobby, BidPanel, discard, callKing, Scoring continue, MatchOver, Yjs banner.
- Remove in-table usage of `PlayHandCards` / `PlayTrickArea` (leave component files for now).

- [ ] **Step 1: Deck select on create form (disable submit if none).**

- [ ] **Step 2: Swap table region to Tres scene.**

- [ ] **Step 3: Manual smoke** — create with deck → bots → start → see 3D table → play one card.

- [ ] **Step 4: Commit** `feat(play): full 3D table on play pages with deck picker`

---

### Task 9: Perf watchdog + debug + README

**Files:**
- Modify: `usePlayQuality.ts`, `TableScene.vue`
- Modify: `README.md` (Jeu de tarot section)

**Behavior:**
- Sample fps via `useRenderLoop` / rAF counter; downgrade once.
- `?debugGfx=1` shows overlay: profile, fps, texture count.
- README: need a `tarot78` deck with optional faces; TresJS WebGL; cycle-2 note.

- [ ] **Step 1: Watchdog + debug overlay.**

- [ ] **Step 2: README pointer.**

- [ ] **Step 3: Commit** `feat(play): adaptive gfx quality and docs`

---

### Task 10: Hardening + E2E / self-check

**Files:**
- Extend: `scripts/validate-tarot-e2e.mjs` — create requires `deckId` (use a real deck id from API or seed); assert `GET deck-textures` returns 78 cards.
- Update CDC status → Implemented when done.

**Checklist:**
1. Create rejects non-tarot78 / foreign deck  
2. Manifest 78 entries + backUrl  
3. Table 3D visible; no 2D hand grid  
4. Missing faces → placeholders  
5. Play + bots still score via cycle 1  
6. Leave page → no texture leak (debugGfx memory drops)  
7. Mobile DevTools / low profile boots  

- [ ] **Step 1: Extend E2E script for deckId + manifest.**

- [ ] **Step 2: Run `pnpm test` + E2E against `:3003`.**

- [ ] **Step 3: Commit** `test(play): cover deck textures and 3d play smoke`

---

## Self-Review (author)

| Spec requirement | Task |
|------------------|------|
| Full 3D table, no 2D grid | 6–8 |
| Host tarot78 deck + S3 faces | 2–5, 8 |
| Placeholders if missing | 5, 7 |
| Cycle-1 intents unchanged | 7–8 |
| Quality profiles + auto downgrade | 5, 9 |
| Dispose / no leak | 5–6, 10 |
| Manifest API seated-only | 4 |

Placeholder scan: stub `TableScene` in Task 1 replaced by Task 6–7.  
Type names: `DeckTextureManifest`, `deckId`, `useCardTextures`, `usePlayQuality`.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-08-12-tarot-table-3d.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session with executing-plans, batched checkpoints  

Which approach?
