#!/usr/bin/env node
/**
 * Player-minded browser validation for tarot play UX.
 * Usage: node scripts/validate-play-ux.mjs [baseUrl]
 */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const baseUrl = process.argv[2] ?? 'http://localhost:3003'
const outDir = join(process.cwd(), '.tmp/play-ux')
mkdirSync(outDir, { recursive: true })

let WebSocket
try {
  WebSocket = require('ws')
} catch {
  const { readdirSync } = await import('node:fs')
  const pnpmWs = readdirSync(join(process.cwd(), 'node_modules/.pnpm')).find(name => name.startsWith('ws@'))
  WebSocket = require(join(process.cwd(), 'node_modules/.pnpm', pnpmWs, 'node_modules/ws'))
}

const { chromium } = require('playwright-core')

let cookieJar = null
const findings = []

function note(ok, title, detail = '') {
  findings.push({ ok, title, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${title}${detail ? ` — ${detail}` : ''}`)
}

async function req(path, { method = 'GET', body } = {}) {
  const headers = {}
  let payload
  if (body !== undefined) {
    payload = JSON.stringify(body)
    headers['Content-Type'] = 'application/json'
  }
  if (cookieJar) headers.Cookie = cookieJar
  return fetch(`${baseUrl}${path}`, { method, headers, body: payload })
}

async function registerOrLogin() {
  const email = 'tarot-ux@example.com'
  const password = 'TarotUx123!'
  let res = await req('/api/auth/login', { method: 'POST', body: { email, password } })
  if (!res.ok) {
    res = await req('/api/auth/register', {
      method: 'POST',
      body: { email, password, confirmPassword: password, username: 'TarotUx' },
    })
  }
  const setCookie = res.headers.getSetCookie?.() ?? []
  const raw = setCookie.join('; ') || res.headers.get('set-cookie') || ''
  const match = raw.match(/nuxt-session=[^;]+/)
  if (!match) throw new Error(`No session cookie (${res.status})`)
  cookieJar = match[0]
}

async function ensureDeck() {
  const decks = await (await req('/api/decks')).json()
  const existing = Array.isArray(decks) ? decks.find(d => d.type === 'tarot78') : null
  if (existing?.id) return existing.id
  const created = await (await req('/api/decks', {
    method: 'POST',
    body: { title: 'UX Tarot 78', type: 'tarot78', visualStyle: 'illustration royale contemporaine' },
  })).json()
  return created.id
}

function wsConnect(code) {
  const url = baseUrl.replace(/^http/, 'ws') + `/game/ws?code=${code}`
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: { Cookie: cookieJar } })
    ws.setMaxListeners?.(40)
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function attachState(ws) {
  const state = { priv: null, pub: null }
  ws.on('message', (raw) => {
    const msg = JSON.parse(String(raw))
    if (msg.type === 'private' && msg.private) state.priv = msg.private
    if (msg.type === 'public' && msg.public) state.pub = msg.public
  })
  return state
}

async function waitUntil(predicate, timeout = 30_000, label = 'condition') {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (predicate()) return true
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error(`timeout waiting for ${label}`)
}

function softDiscard(hand, n) {
  const preferred = hand.filter(card =>
    !String(card).startsWith('trump-')
    && card !== 'excuse'
    && !String(card).endsWith('-k')
    && !String(card).endsWith('-q'),
  )
  const pool = preferred.length >= n ? preferred : hand.filter(c => c !== 'excuse' && !String(c).startsWith('trump-'))
  return (pool.length >= n ? pool : hand).slice(0, n)
}

async function bootstrapToPlay(deckId) {
  const created = await (await req('/api/game/create', {
    method: 'POST',
    body: { playerCount: 4, endMode: 'deals', endValue: 1, deckId },
  })).json()
  const code = created.code
  const ws = await wsConnect(code)
  const state = attachState(ws)
  ws.send(JSON.stringify({ type: 'hello' }))
  await waitUntil(() => state.priv, 10_000, 'hello private')

  for (let i = 0; i < 3; i++) {
    ws.send(JSON.stringify({ type: 'intent', intent: { type: 'addBot' } }))
    await waitUntil(() => (state.priv?.seats?.filter(s => s?.controlledBy === 'bot').length ?? 0) >= i + 1, 8_000, `bot ${i + 1}`)
  }
  ws.send(JSON.stringify({ type: 'intent', intent: { type: 'start' } }))

  const started = Date.now()
  while (Date.now() - started < 90_000) {
    const priv = state.priv
    if (!priv) {
      await new Promise(r => setTimeout(r, 100))
      continue
    }
    if (priv.phase === 'Trick' || priv.phase === 'ReadyToPlay') {
      return { code, ws, state }
    }
    if (priv.phase === 'Bidding' && priv.currentSeat === priv.seat) {
      ws.send(JSON.stringify({ type: 'intent', intent: { type: 'bid', bid: 'passe' } }))
      await new Promise(r => setTimeout(r, 250))
      continue
    }
    if (priv.phase === 'DogEcarta' && priv.currentSeat === priv.seat && priv.hand?.length) {
      const n = priv.playerCount === 5 ? 3 : 6
      const cards = softDiscard(priv.hand, n)
      if (cards.length === n) {
        ws.send(JSON.stringify({ type: 'intent', intent: { type: 'discard', cards } }))
        await new Promise(r => setTimeout(r, 300))
      }
    }
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`Did not reach play (last phase=${state.priv?.phase})`)
}

function maybePlay(ws, state) {
  const priv = state.priv
  if (!priv) return false
  if ((priv.phase === 'Trick' || priv.phase === 'ReadyToPlay')
    && priv.currentSeat === priv.seat
    && priv.legalMoves?.length) {
    ws.send(JSON.stringify({ type: 'intent', intent: { type: 'playCard', card: priv.legalMoves[0] } }))
    return true
  }
  return false
}

async function main() {
  console.log(`\n=== Play UX validation @ ${baseUrl} ===\n`)
  await registerOrLogin()
  const deckId = await ensureDeck()
  const { code, ws, state } = await bootstrapToPlay(deckId)
  note(true, 'Table créée et partie démarrée', `code=${code} phase=${state.priv.phase}`)

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,800'],
  })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'fr-FR',
  })
  const cookieName = cookieJar.split('=')[0]
  const cookieValue = cookieJar.slice(cookieName.length + 1)
  await context.addCookies([{ name: cookieName, value: cookieValue, url: baseUrl }])

  const page = await context.newPage()
  page.setDefaultTimeout(60_000)
  await page.goto(`${baseUrl}/play/${code}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

  // Wait until the live table HUD is up (not the connecting shell / deck loader).
  const tableReady = await page.waitForFunction(() => {
    const text = document.body?.innerText || ''
    if (/Connexion en cours|Chargement du deck|Préparation de la table/i.test(text)) {
      return false
    }
    return /Pli en cours|Donne\s+\d+|à toi|Prêt à jouer/i.test(text)
  }, { timeout: 90_000 }).then(() => true).catch(() => false)

  await page.screenshot({ path: join(outDir, '01-enter.png') })
  note(tableReady, 'Table 3D + HUD visibles pour le joueur')

  if (!tableReady) {
    writeFileSync(join(outDir, 'report.json'), JSON.stringify({ baseUrl, code, findings, at: new Date().toISOString() }, null, 2))
    await browser.close()
    ws.close()
    process.exit(1)
  }

  // Play until a trick resolves, tracking server pause.
  let seenLastKey = state.pub?.lastTrick?.map(e => `${e.seat}:${e.card}`).join('|')
    ?? state.priv?.lastTrick?.map(e => `${e.seat}:${e.card}`).join('|')
    ?? null
  let trickEndedAt = null
  let nextCardAt = null
  const playStarted = Date.now()

  while (Date.now() - playStarted < 120_000 && nextCardAt == null) {
    const pub = state.pub ?? state.priv
    const lastKey = pub?.lastTrick?.map(e => `${e.seat}:${e.card}`).join('|') ?? null
    const trickLen = pub?.trick?.length ?? 0

    if (lastKey && lastKey !== seenLastKey && trickLen === 0 && trickEndedAt == null) {
      seenLastKey = lastKey
      trickEndedAt = Date.now()
      note(true, 'Premier pli résolu côté serveur', lastKey)

      // Capture summary while client holds the finished trick.
      let sawSummary = false
      let summaryTitle = ''
      const fxDeadline = Date.now() + 4_500
      while (Date.now() < fxDeadline) {
        const fx = page.locator('[data-testid="table-fx-trick-won"], [data-testid="table-fx-petit-steal"]')
        if (await fx.count()) {
          sawSummary = true
          summaryTitle = (await fx.first().getAttribute('data-fx-title')) || ''
          await page.screenshot({ path: join(outDir, '02-trick-summary.png') })
          break
        }
        const body = await page.locator('body').innerText()
        const match = body.match(/Pli pour[^\n]+|Petit volé[^\n]+|Fin de pli[^\n]+|coupe avec[^\n]+/)
        if (match) {
          sawSummary = true
          summaryTitle = match[0]
          await page.screenshot({ path: join(outDir, '02-trick-summary.png') })
          break
        }
        await page.waitForTimeout(100)
      }
      note(sawSummary, 'Résumé de pli visible après un pli', summaryTitle || (sawSummary ? 'ok' : 'aucun résumé'))

      // Tempo: keep reading the summary — bots must not wipe it instantly.
      await page.waitForTimeout(2_800)
      const stillReadable = await page.evaluate(() => {
        const text = document.body?.innerText || ''
        return /Fin de pli|Pli pour|Petit volé|coupe avec|plus fort/i.test(text)
          || !!document.querySelector('[data-testid="table-fx-trick-won"], [data-testid="table-fx-petit-steal"]')
      })
      note(stillReadable, 'Tempo après pli suffisant', stillReadable
        ? 'résumé encore lisible après 2.8s'
        : 'résumé disparu trop tôt')

      // Resume via UI clicks (browser peer owns the seat socket).
      const resumeDeadline = Date.now() + 14_000
      while (Date.now() < resumeDeadline) {
        const hand = page.locator('button.origin-bottom')
        const n = await hand.count().catch(() => 0)
        for (let i = 0; i < Math.min(n, 18); i++) {
          const btn = hand.nth(i)
          const opacity = await btn.evaluate(el => Number(getComputedStyle(el).opacity)).catch(() => 1)
          if (opacity < 0.75) continue
          await btn.click({ force: true }).catch(() => {})
          await page.waitForTimeout(200)
          break
        }
        const resumed = await page.evaluate(() => {
          const text = document.body?.innerText || ''
          const hasFx = !!document.querySelector('[data-testid="table-fx-trick-won"], [data-testid="table-fx-petit-steal"]')
          return /Pli en cours/i.test(text) && !hasFx && !/Fin de pli/i.test(text)
        })
        if (resumed) {
          nextCardAt = Date.now()
          break
        }
        await new Promise(r => setTimeout(r, 300))
      }
      note(nextCardAt != null, 'La partie reprend après le résumé', nextCardAt ? `${nextCardAt - trickEndedAt}ms` : 'bloquée')
      break
    }

    maybePlay(ws, state)
    await new Promise(r => setTimeout(r, 200))
  }

  if (trickEndedAt == null) {
    note(false, 'Premier pli résolu côté serveur', 'timeout')
  }

  const chienVisible = await page.getByText(/^Chien$/i).isVisible().catch(() => false)
  const phase = state.pub?.phase ?? state.priv?.phase
  note(!(phase === 'Trick' && chienVisible), 'Chien disparaît une fois le jeu lancé', chienVisible ? 'encore affiché' : 'ok')

  const chipsGone = !(await page.locator('text=jeton').count().catch(() => 0))
  note(chipsGone, 'Pas de jetons présentés comme éléments de jeu')

  await page.screenshot({ path: join(outDir, '03-late.png') })
  await browser.close()
  ws.close()

  writeFileSync(join(outDir, 'report.json'), JSON.stringify({ baseUrl, code, findings, at: new Date().toISOString() }, null, 2))
  console.log(`\nScreenshots → ${outDir}`)
  const failed = findings.filter(f => !f.ok)
  if (failed.length) {
    console.error(`\n${failed.length} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll player-facing checks passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
