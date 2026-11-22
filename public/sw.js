/*
 * Service worker of the home-screen app. Deliberately small: the game needs
 * the network (live table, accounts), so pages always come from the server.
 * It only keeps the hashed build files for faster starts and shows a friendly
 * page instead of the browser error when the phone is offline.
 */
const VERSION = 'cards-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`
const OFFLINE_URL = '/offline.html'
const SHELL_FILES = [OFFLINE_URL, '/icon-192.png', '/favicon.svg']
const MAX_ASSETS = 160

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => !key.startsWith(VERSION)).map(key => caches.delete(key)))
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable()
    }
    await self.clients.claim()
  })())
})

async function trim(cache) {
  const keys = await cache.keys()
  if (keys.length > MAX_ASSETS) {
    await Promise.all(keys.slice(0, keys.length - MAX_ASSETS).map(key => cache.delete(key)))
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preloaded = await event.preloadResponse
        return preloaded || await fetch(request)
      } catch {
        const cache = await caches.open(SHELL)
        return (await cache.match(OFFLINE_URL)) || Response.error()
      }
    })())
    return
  }

  // Build files carry a content hash in their name: safe to serve from cache.
  if (url.pathname.startsWith('/_nuxt/') && /[.-][\w-]{8,}\.(?:js|css|woff2?)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSETS)
      const cached = await cache.match(request)
      if (cached) {
        return cached
      }
      const response = await fetch(request)
      if (response.ok) {
        event.waitUntil(cache.put(request, response.clone()).then(() => trim(cache)))
      }
      return response
    })())
  }
})
