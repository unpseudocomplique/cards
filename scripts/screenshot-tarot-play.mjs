#!/usr/bin/env node
/**
 * Visual smoke: login → create table → bots → start → screenshot play table.
 * Usage: node scripts/screenshot-tarot-play.mjs [baseUrl] [outPath]
 */
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const baseUrl = process.argv[2] ?? 'http://localhost:3003'
const outPath = process.argv[3] ?? join(process.cwd(), '.tmp/tarot-play.png')

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
  const email = 'tarot-e2e@example.com'
  const password = 'TarotE2e123!'
  let res = await req('/api/auth/login', { method: 'POST', body: { email, password } })
  if (!res.ok) {
    res = await req('/api/auth/register', {
      method: 'POST',
      body: { email, password, confirmPassword: password, username: 'TarotE2e' },
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
    body: { title: 'Screenshot Tarot 78', type: 'tarot78', visualStyle: 'illustration royale contemporaine' },
  })).json()
  return created.id
}

function wsConnect(code) {
  const url = baseUrl.replace(/^http/, 'ws') + `/game/ws?code=${code}`
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: { Cookie: cookieJar } })
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function waitPrivate(ws, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout private')), timeout)
    const onMsg = (raw) => {
      const msg = JSON.parse(String(raw))
      if (msg.type === 'private' && msg.private) {
        clearTimeout(t)
        ws.off('message', onMsg)
        resolve(msg.private)
      }
    }
    ws.on('message', onMsg)
  })
}

async function bootstrapTable(deckId) {
  const created = await (await req('/api/game/create', {
    method: 'POST',
    body: { playerCount: 4, endMode: 'deals', endValue: 1, deckId },
  })).json()
  const code = created.code
  const ws = await wsConnect(code)
  ws.send(JSON.stringify({ type: 'hello' }))
  await waitPrivate(ws)
  for (let i = 0; i < 3; i++) {
    ws.send(JSON.stringify({ type: 'intent', intent: { type: 'addBot' } }))
    await waitPrivate(ws)
  }
  ws.send(JSON.stringify({ type: 'intent', intent: { type: 'start' } }))
  let priv = await waitPrivate(ws)
  // Advance through bidding quickly with host passes if needed
  for (let step = 0; step < 40; step++) {
    if (priv.phase === 'Trick' || priv.phase === 'ReadyToPlay' || priv.phase === 'DogEcarta') break
    if (priv.phase === 'Bidding' && priv.currentSeat === priv.seat) {
      ws.send(JSON.stringify({ type: 'intent', intent: { type: 'bid', bid: 'passe' } }))
      priv = await waitPrivate(ws)
      continue
    }
    await new Promise(r => setTimeout(r, 500))
    // drain
    try {
      priv = await waitPrivate(ws, 1500)
    } catch {
      // bots may be acting
    }
  }
  ws.close()
  return { code, phase: priv.phase }
}

async function main() {
  await registerOrLogin()
  const deckId = await ensureDeck()
  const { code, phase } = await bootstrapTable(deckId)
  console.log('table', code, 'phase', phase)

  mkdirSync(dirname(outPath), { recursive: true })
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,900'],
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  const cookieName = cookieJar.split('=')[0]
  const cookieValue = cookieJar.slice(cookieName.length + 1)
  await context.addCookies([{
    name: cookieName,
    value: cookieValue,
    url: baseUrl,
  }])
  const page = await context.newPage()
  await page.goto(`${baseUrl}/play/${code}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2000)

  // If bidding UI is visible, pass to let bots finish and reach a playable table.
  for (let i = 0; i < 8; i++) {
    const passe = page.getByRole('button', { name: 'Passe' })
    if (await passe.count()) {
      await passe.click({ force: true }).catch(() => {})
      await page.waitForTimeout(900)
    } else {
      break
    }
  }
  await page.waitForTimeout(3500)
  await page.screenshot({ path: outPath, fullPage: false })

  const hoverPath = outPath.replace(/\.png$/, '-hover.png')
  const handBtn = page.locator('button.origin-bottom').first()
  if (await handBtn.count()) {
    await handBtn.hover({ force: true }).catch(() => {})
    await page.waitForTimeout(700)
    await page.screenshot({ path: hoverPath, fullPage: false })
  }
  await browser.close()
  console.log('wrote', outPath)
  if (hoverPath) console.log('wrote', hoverPath)
  writeFileSync(outPath.replace(/\.png$/, '.json'), JSON.stringify({ code, phase, outPath }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
