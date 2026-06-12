// VinWin Kitchen — Service Worker
// Cache-first for assets, network-first for recipes.json (always fresh when online)

const CACHE = 'vinwin-v1';
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon-64.png',
  '/apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap',
];

// Install: cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - recipes.json: network-first (always try to get fresh), fall back to cache
// - Firebase / gstatic / fonts: network-only (no cache — auth/live data)
// - Everything else: cache-first
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin Firebase/gstatic requests
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('firebase') || url.hostname.includes('gstatic.com')) return;

  // recipes.json — network first, cache fallback
  if (url.pathname === '/recipes.json') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // SPA routes — serve index.html from cache
  if (url.pathname.startsWith('/recipe/') || url.pathname === '/stats') {
    e.respondWith(caches.match('/index.html'));
    return;
  }

  // Everything else — cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Only cache same-origin successful responses
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
