#!/usr/bin/env node
/**
 * Manual E2E validation for tarot cycle-1 against a running dev server.
 * Usage: node scripts/validate-tarot-e2e.mjs [baseUrl]
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const baseUrl = process.argv[2] ?? 'http://localhost:3003'

let WebSocket
try {
  WebSocket = require('ws')
} catch {
  const { readdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const pnpmWs = readdirSync(join(process.cwd(), 'node_modules/.pnpm'))
    .find(name => name.startsWith('ws@'))
  if (!pnpmWs) {
    throw new Error('ws package not found — run pnpm install')
  }
  WebSocket = require(join(process.cwd(), 'node_modules/.pnpm', pnpmWs, 'node_modules/ws'))
}

const results = []
let cookieJar = null

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail })
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`)
}

function req(path, { method = 'GET', body, cookies } = {}) {
  const headers = {}
  let payload
  if (body !== undefined) {
    payload = JSON.stringify(body)
    headers['Content-Type'] = 'application/json'
  }
  if (cookies ?? cookieJar) {
    headers.Cookie = cookies ?? cookieJar
  }
  return fetch(`${baseUrl}${path}`, { method, headers, body: payload })
}

async function login(email, password) {
  const res = await req('/api/auth/login', { method: 'POST', body: { email, password } })
  const setCookie = res.headers.getSetCookie?.() ?? []
  const raw = setCookie.join('; ') || res.headers.get('set-cookie') || ''
  const match = raw.match(/nuxt-session=[^;]+/)
  if (!match) {
    throw new Error('No session cookie from login')
  }
  cookieJar = match[0]
  return res.json()
}

async function register(email, password, username) {
  const res = await req('/api/auth/register', {
    method: 'POST',
    body: { email, password, confirmPassword: password, username },
  })
  if (res.status === 409) {
    return login(email, password)
  }
  if (!res.ok) {
    throw new Error(`register failed ${res.status}: ${await res.text()}`)
  }
  const setCookie = res.headers.getSetCookie?.() ?? []
  const raw = setCookie.join('; ') || res.headers.get('set-cookie') || ''
  const match = raw.match(/nuxt-session=[^;]+/)
  if (match) {
    cookieJar = match[0]
  }
  return res.json()
}

function wsConnect(code, cookies) {
  const wsUrl = baseUrl.replace(/^http/, 'ws') + `/game/ws?code=${encodeURIComponent(code)}`
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookies } })
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function wsSend(ws, payload) {
  ws.send(JSON.stringify(payload))
}

function attachMessageCollector(ws) {
  const queue = []
  ws.on('message', (data) => {
    try {
      queue.push(JSON.parse(String(data)))
    } catch {
      // ignore
    }
  })
  return {
    drain(timeoutMs = 0) {
      return new Promise((resolve) => {
        const deadline = Date.now() + timeoutMs
        const items = []
        function pull() {
          while (queue.length) {
            items.push(queue.shift())
          }
          if (timeoutMs > 0 && Date.now() < deadline) {
            setTimeout(pull, 50)
            return
          }
          resolve(items)
        }
        pull()
      })
    },
    async waitFor(predicate, timeoutMs = 8000) {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        while (queue.length) {
          const msg = queue.shift()
          if (predicate(msg)) {
            return msg
          }
        }
        await new Promise(r => setTimeout(r, 50))
      }
      throw new Error('ws timeout')
    },
  }
}

async function main() {
  console.log(`\n=== Tarot E2E validation @ ${baseUrl} ===\n`)

  // 1. Health
  try {
    const res = await fetch(baseUrl)
    if (res.ok || res.status === 302) {
      pass('Server reachable', String(res.status))
    } else {
      fail('Server reachable', String(res.status))
    }
  } catch (e) {
    fail('Server reachable', e.message)
    printSummary()
    process.exit(1)
  }

  // 2. Auth
  const email = 'tarot-e2e@example.com'
  const password = 'TarotE2e123!'
  try {
    await register(email, password, 'TarotE2e')
    pass('Auth session')
  } catch (e) {
    fail('Auth session', e.message)
    printSummary()
    process.exit(1)
  }

  // 3. Ensure tarot78 deck for create + textures
  let deckId
  try {
    const decksRes = await req('/api/decks')
    const decks = await decksRes.json()
    const existing = Array.isArray(decks) ? decks.find(d => d.type === 'tarot78') : null
    if (existing?.id) {
      deckId = existing.id
      pass('Tarot78 deck ready', deckId)
    } else {
      const createDeck = await req('/api/decks', {
        method: 'POST',
        body: {
          title: 'E2E Tarot 78',
          type: 'tarot78',
          visualStyle: 'test e2e style illustration',
        },
      })
      const created = await createDeck.json()
      deckId = created.id
      if (!deckId) {
        throw new Error(JSON.stringify(created))
      }
      pass('Tarot78 deck created', deckId)
    }
  } catch (e) {
    fail('Tarot78 deck ready', e.message)
    printSummary()
    process.exit(1)
  }

  // 4. Create table
  let code
  try {
    const res = await req('/api/game/create', {
      method: 'POST',
      body: { playerCount: 4, endMode: 'deals', endValue: 1, deckId },
    })
    const data = await res.json()
    code = data.code
    if (!code) {
      throw new Error(JSON.stringify(data))
    }
    pass('Create table', code)
  } catch (e) {
    fail('Create table', e.message)
    printSummary()
    process.exit(1)
  }

  // 4b. Deck texture manifest (cycle 2)
  try {
    const res = await req(`/api/game/${code}/deck-textures`)
    const manifest = await res.json()
    if (res.ok && Array.isArray(manifest.cards) && manifest.cards.length === 78) {
      pass('Deck texture manifest', `78 cards, back=${manifest.backUrl ? 'url' : 'null'}`)
    } else {
      fail('Deck texture manifest', JSON.stringify(manifest).slice(0, 160))
    }
  } catch (e) {
    fail('Deck texture manifest', e.message)
  }

  // 4. Public peek — no hands leaked
  try {
    const peek = await (await req(`/api/game/${code}`)).json()
    const json = JSON.stringify(peek)
    if (json.includes('"hand"') || Array.isArray(peek.hands)) {
      fail('Public view secrecy', 'hands found in public API')
    } else if (peek.seats[0]?.userId && peek.phase === 'Lobby') {
      pass('Public view secrecy', 'host seated, no hands')
    } else {
      fail('Public view secrecy', JSON.stringify(peek).slice(0, 120))
    }
  } catch (e) {
    fail('Public view secrecy', e.message)
  }

  // 5. Host WS hello (no join needed)
  let hostWs
  let hostInbox
  try {
    hostWs = await wsConnect(code, cookieJar)
    hostInbox = attachMessageCollector(hostWs)
    wsSend(hostWs, { type: 'hello' })
    const msg = await hostInbox.waitFor(m => m.type === 'private' && m.private)
    const priv = msg.private
    if (priv.seat !== 0) {
      throw new Error(`expected seat 0, got ${priv.seat}`)
    }
    pass('Host hello', `seat ${priv.seat}`)
  } catch (e) {
    fail('Host hello', e.message)
  }

  // 6. Host duplicate join rejected (not surfaced as fatal — error type)
  try {
    wsSend(hostWs, { type: 'intent', intent: { type: 'join', name: 'dup' } })
    const err = await hostInbox.waitFor(m => m.type === 'error', 3000)
    if (err.reason === 'Already seated at this table') {
      pass('Host duplicate join blocked')
    } else {
      fail('Host duplicate join blocked', JSON.stringify(err))
    }
  } catch (e) {
    fail('Host duplicate join blocked', e.message)
  }

  // 7. Add 3 bots
  try {
    for (let i = 0; i < 3; i++) {
      wsSend(hostWs, { type: 'intent', intent: { type: 'addBot' } })
      const msg = await hostInbox.waitFor(m => m.type === 'private' && m.private)
      const priv = msg.private
      const filled = priv.seats.filter(s => s.userId).length
      if (filled !== i + 2) {
        throw new Error(`expected ${i + 2} filled, got ${filled}`)
      }
    }
    pass('Add 3 bots')
  } catch (e) {
    fail('Add 3 bots', e.message)
  }

  // 8. Public API reflects bots
  try {
    const peek = await (await req(`/api/game/${code}`)).json()
    const filled = peek.seats.filter(s => s.userId).length
    if (filled === 4) {
      pass('Public API after bots', '4/4 seats')
    } else {
      fail('Public API after bots', `${filled}/4`)
    }
  } catch (e) {
    fail('Public API after bots', e.message)
  }

  // 9. Start → Bidding with 18 cards
  try {
    wsSend(hostWs, { type: 'intent', intent: { type: 'start' } })
    const msg = await hostInbox.waitFor(m => m.type === 'private' && m.private, 15000)
    const priv = msg.private
    if (priv.phase !== 'Bidding' || priv.hand.length !== 18) {
      throw new Error(`phase=${priv.phase} hand=${priv.hand.length}`)
    }
    pass('Start deal', `Bidding, ${priv.hand.length} cards`)
  } catch (e) {
    fail('Start deal', e.message)
  }

  // 10. Full playthrough to MatchOver (CDC §Done #2–3)
  try {
    let priv = null
    const phases = []
    for (let step = 0; step < 250; step++) {
      const msgs = await hostInbox.drain(350)
      for (const msg of msgs) {
        if (msg.type === 'private' && msg.private) {
          priv = msg.private
        }
      }
      if (!priv) {
        const msg = await hostInbox.waitFor(m => m.type === 'private' && m.private, 5000)
        priv = msg.private
      }

      const phase = priv.phase
      if (!phases.length || phases[phases.length - 1] !== phase) {
        phases.push(phase)
      }
      if (phase === 'MatchOver') {
        break
      }
      if (phase === 'Scoring') {
        wsSend(hostWs, { type: 'intent', intent: { type: 'continue' } })
        try {
          const msg = await hostInbox.waitFor(m => m.type === 'private' && m.private, 5000)
          priv = msg.private
        } catch {
          // auto-continue from server may race
        }
        continue
      }
      if (priv.currentSeat !== priv.seat) {
        await new Promise(r => setTimeout(r, 450))
        continue
      }
      if (phase === 'Bidding') {
        wsSend(hostWs, { type: 'intent', intent: { type: 'bid', bid: 'passe' } })
      } else if (phase === 'DogEcarta') {
        const n = priv.playerCount === 5 ? 3 : 6
        wsSend(hostWs, { type: 'intent', intent: { type: 'discard', cards: priv.hand.slice(0, n) } })
      } else if (phase === 'Trick' || phase === 'ReadyToPlay') {
        const moves = priv.legalMoves ?? []
        if (!moves.length) {
          await new Promise(r => setTimeout(r, 400))
          continue
        }
        wsSend(hostWs, { type: 'intent', intent: { type: 'playCard', card: moves[0] } })
      } else {
        await new Promise(r => setTimeout(r, 300))
        continue
      }
      try {
        const msg = await hostInbox.waitFor(m => m.type === 'private' && m.private, 5000)
        priv = msg.private
      } catch {
        // bots may chain updates
      }
    }
    if (priv?.phase === 'MatchOver' && Array.isArray(priv.scores)) {
      pass('Full playthrough', `phases: ${phases.join(' → ')}; scores=${JSON.stringify(priv.scores)}`)
    } else {
      fail('Full playthrough', `stuck at ${priv?.phase}, seen: ${phases.join(' → ')}`)
    }
  } catch (e) {
    fail('Full playthrough', e.message)
  }

  hostWs?.close()

  // 11. Guest join on host invite (CDC §Done #1)
  let hostCookie = cookieJar
  try {
    await login(email, password)
    hostCookie = cookieJar
    const res = await req('/api/game/create', {
      method: 'POST',
      body: { playerCount: 4, endMode: 'deals', endValue: 1, deckId },
    })
    const guestCode = (await res.json()).code
    await register('tarot-guest@example.com', password, 'TarotGuest')
    const guestWs = await wsConnect(guestCode, cookieJar)
    const guestInbox = attachMessageCollector(guestWs)
    // Guest may get NOT_SEATED on hello; join seats them
    wsSend(guestWs, { type: 'hello' })
    await guestInbox.drain(300)
    wsSend(guestWs, { type: 'intent', intent: { type: 'join', name: 'Guest' } })
    const msg = await guestInbox.waitFor(m => m.type === 'private' && m.private, 5000)
    const priv = msg.private
    if (priv.seat >= 1 && priv.seats.some(s => s.name === 'Guest')) {
      pass('Guest join', `seat ${priv.seat}`)
    } else {
      fail('Guest join', JSON.stringify({ seat: priv.seat, seats: priv.seats.map(s => s.name) }))
    }
    guestWs.close()
  } catch (e) {
    fail('Guest join', e.message)
  }

  // Restore host session for remaining checks
  cookieJar = hostCookie
  try {
    await login(email, password)
  } catch {
    // keep current cookie
  }

  // 12. Disconnect reclaim via store path is covered by vitest; smoke WS hello after create
  try {
    const res = await req('/api/game/create', {
      method: 'POST',
      body: { playerCount: 4, endMode: 'deals', endValue: 1, deckId },
    })
    const reclaimCode = (await res.json()).code
    const ws1 = await wsConnect(reclaimCode, cookieJar)
    const inbox1 = attachMessageCollector(ws1)
    wsSend(ws1, { type: 'hello' })
    await inbox1.waitFor(m => m.type === 'private' && m.private)
    ws1.close()
    await new Promise(r => setTimeout(r, 300))
    const ws2 = await wsConnect(reclaimCode, cookieJar)
    const inbox2 = attachMessageCollector(ws2)
    wsSend(ws2, { type: 'hello' })
    const msg = await inbox2.waitFor(m => m.type === 'private' && m.private)
    if (msg.private.seat === 0 && msg.private.seats[0]?.controlledBy === 'human') {
      pass('Reconnect hello reclaim', 'seat 0 human')
    } else {
      fail('Reconnect hello reclaim', JSON.stringify(msg.private.seats[0]))
    }
    ws2.close()
  } catch (e) {
    fail('Reconnect hello reclaim', e.message)
  }

  // 12. 3-player table
  try {
    const res = await req('/api/game/create', {
      method: 'POST',
      body: { playerCount: 3, endMode: 'deals', endValue: 1, deckId },
    })
    const code3 = (await res.json()).code
    const peek = await (await req(`/api/game/${code3}`)).json()
    if (peek.playerCount === 3 && peek.seats.length === 3) {
      pass('3-player table create')
    } else {
      fail('3-player table create')
    }
  } catch (e) {
    fail('3-player table create', e.message)
  }

  // 13. 5-player table
  try {
    const res = await req('/api/game/create', {
      method: 'POST',
      body: { playerCount: 5, endMode: 'threshold', endValue: 1000, deckId },
    })
    const code5 = (await res.json()).code
    const peek = await (await req(`/api/game/${code5}`)).json()
    if (peek.playerCount === 5 && peek.seats.length === 5) {
      pass('5-player table create')
    } else {
      fail('5-player table create')
    }
  } catch (e) {
    fail('5-player table create', e.message)
  }

  // 14. Create without deckId rejected
  try {
    const res = await req('/api/game/create', {
      method: 'POST',
      body: { playerCount: 4, endMode: 'deals', endValue: 1 },
    })
    if (res.status === 400) {
      pass('Create without deckId blocked', '400')
    } else {
      fail('Create without deckId blocked', String(res.status))
    }
  } catch (e) {
    fail('Create without deckId blocked', e.message)
  }

  // 15. Unauthorized create
  try {
    const res = await fetch(`${baseUrl}/api/game/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount: 4, deckId }),
    })
    if (res.status === 401) {
      pass('Unauthorized create blocked', '401')
    } else {
      fail('Unauthorized create blocked', String(res.status))
    }
  } catch (e) {
    fail('Unauthorized create blocked', e.message)
  }

  printSummary()
  process.exit(results.some(r => !r.ok) ? 1 : 0)
}

function printSummary() {
  const ok = results.filter(r => r.ok).length
  const total = results.length
  console.log(`\n=== ${ok}/${total} checks passed ===\n`)
  if (ok < total) {
    console.log('Failed:')
    for (const r of results.filter(x => !x.ok)) {
      console.log(`  - ${r.name}: ${r.detail}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
