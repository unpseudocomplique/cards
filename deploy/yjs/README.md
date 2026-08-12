# Yjs WebSocket server (prod)

Compatible with Cards: **yjs@13.6.32** + client **y-websocket@3.1.0**.

## Why this image

| Option | Result |
|--------|--------|
| Repo `yjs/y-websocket` v3 + Nixpacks | No server binary → crash / `y-websocket.cjs` missing |
| Empty Start Command | `/bin/bash: -c: option requires an argument` |
| `@y/websocket-server` | Depends on **yjs@14** (still beta) → breaks yjs@13 clients |
| **This Dockerfile** (`y-websocket@2.0.4` server) | Protocol-compatible with current Cards stack |

“Latest Yjs” for Cards today = **latest stable yjs 13** (`13.6.32`), not yjs 14.

## Coolify setup

1. Application → **Build Pack**: Dockerfile  
2. **Base Directory**: `deploy/yjs` (if Git source = `cards` repo)  
   — or set **Dockerfile Location** to `/deploy/yjs/Dockerfile`  
3. **Ports Exposes**: `1234`  
4. **Start Command**: leave **empty** (CMD is in the image)  
5. Domain: `https://realtime-tarot.untestcomplique.com`  
6. Redeploy

On the **Cards** app:

```dotenv
NUXT_PUBLIC_YJS_WEBSOCKET_URL=wss://realtime-tarot.untestcomplique.com
```

## Migration to yjs 14 + `@y/websocket-server` (blocked)

Do **not** ship this yet. Blockers as of 2026-08-12:

1. `yjs@latest` is still **13.6.32**; 14 is only on `beta` / `next` tags (`14.0.0-16`).
2. `@y/websocket-server@0.1.5` depends on `yjs@^14.0.0-7` (pre-release).
3. TipTap collaboration peers still require **`yjs@^13`** (`@tiptap/y-tiptap`, `@tiptap/extension-collaboration`). Nuxt UI pulls TipTap; forcing one Yjs singleton means we cannot dual-run 13+14 without `Yjs was already imported`.
4. Earlier local attempt (`@y/websocket-server` + yjs 13 client) failed with protocol mismatches (`getClock is not a function`).

**When unblocked** (yjs 14 stable + TipTap peers updated):

1. Bump Cards deps: `yjs@14`, `@y/protocols`, client websocket package matching the server.
2. Replace `deploy/yjs/Dockerfile` with `@y/websocket-server` entrypoint.
3. Redeploy Coolify yjs + Cards together (no mixed 13/14 rooms).
4. Smoke: create table, Yjs connect banner clear, 1 donne with bots.
