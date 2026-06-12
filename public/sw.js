// ListenWell service worker — network-first for navigations, cache-first for assets
const CACHE = 'listenwell-v2'

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  // Only handle GET requests from our origin
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith(self.location.origin)) return
  // Don't cache blob: object URLs (audio/image data)
  if (e.request.url.startsWith('blob:')) return

  // Navigations (index.html): network-first so new deploys are picked up,
  // falling back to cache when offline
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', clone))
        }
        return res
      }).catch(() => caches.match('/index.html')),
    )
    return
  }

  // Hashed assets: cache-first
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
        }
        return res
      }).catch(() => caches.match('/index.html'))
    }),
  )
})
