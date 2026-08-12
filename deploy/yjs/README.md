# Yjs WebSocket server (prod)

Compatible with Cards: **yjs@13.6.32** + client **y-websocket@3.1.0**.

## Why this image

| Option | Result |
|--------|--------|
| Repo `yjs/y-websocket` v3 + Nixpacks | No server binary → crash / `y-websocket.cjs` missing |
| Empty Start Command | `/bin/bash: -c: option requires an argument` |
| `@y/websocket-server` | Depends on **yjs@14** → breaks yjs@13 clients |
| **This Dockerfile** (`y-websocket@2.0.4` server) | Protocol-compatible with current Cards stack |

“Latest Yjs” for Cards today = **latest stable yjs 13** (`13.6.32`), not yjs 14 (still RC ecosystem).

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
