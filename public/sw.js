const SHELL_CACHE = 'ironplan-shell-v4'
const RUNTIME_CACHE = 'ironplan-runtime-v4'
const OFFLINE_URL = '/offline'
const NAVIGATION_TIMEOUT_MS = 4500

const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/progress',
  '/profile',
  '/auth/login',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icon?size=192',
  '/icon?size=512',
  '/apple-icon'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined)
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )

      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable().catch(() => undefined)
      }

      await self.clients.claim()
    })()
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

async function networkFirstNavigation(request, preloadResponsePromise) {
  try {
    const preloadResponse = await preloadResponsePromise
    if (preloadResponse) return preloadResponse

    const networkResponse = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('navigation timeout')), NAVIGATION_TIMEOUT_MS))
    ])

    const copy = networkResponse.clone()
    caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
    return networkResponse
  } catch {
    const cachedPage = await caches.match(request)
    if (cachedPage) return cachedPage

    const cachedDashboard = await caches.match('/dashboard')
    if (cachedDashboard) return cachedDashboard

    const cachedOffline = await caches.match(OFFLINE_URL)
    return cachedOffline || Response.error()
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)
  const networkFetch = fetch(request)
    .then((response) => {
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response
      }
      const copy = response.clone()
      caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
      return response
    })
    .catch(() => cached)

  return cached || networkFetch
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  const requestUrl = new URL(request.url)
  const isSameOrigin = requestUrl.origin === self.location.origin

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request, event.preloadResponse))
    return
  }

  if (!isSameOrigin) return

  // Skip /api/ routes and Next.js build artifacts to avoid stale server action IDs.
  if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname.startsWith('/_next/')) return

  event.respondWith(staleWhileRevalidate(request))
})
