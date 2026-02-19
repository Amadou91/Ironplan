const SHELL_CACHE = 'ironplan-shell-v3'
const RUNTIME_CACHE = 'ironplan-runtime-v3'
const OFFLINE_URL = '/offline'
const PRECACHE_URLS = ['/', '/dashboard', '/progress', OFFLINE_URL, '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => undefined)
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  const requestUrl = new URL(request.url)
  const isSameOrigin = requestUrl.origin === self.location.origin

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
          return response
        })
        .catch(async () => {
          const cachedPage = await caches.match(request)
          if (cachedPage) return cachedPage
          const cachedOffline = await caches.match(OFFLINE_URL)
          return cachedOffline || Response.error()
        })
    )
    return
  }

  if (!isSameOrigin) return

  // Skip /api/ routes and Next.js built assets – Next.js uses content-hashed
  // filenames with immutable cache headers, so the browser cache is sufficient.
  // Caching them in the SW risks serving stale JS that contains outdated server
  // action IDs, which causes "Failed to find Server Action" errors (especially
  // on iPad PWA where tabs/apps survive across deployments without a hard refresh).
  if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname.startsWith('/_next/')) return

  event.respondWith(
    caches.match(request).then((cached) => {
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
    })
  )
})
