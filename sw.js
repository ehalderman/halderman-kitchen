// VinWin Kitchen — Service Worker
// v2: app shell is NETWORK-FIRST so deployed fixes reach clients immediately.
// Bump CACHE on every change to this file.

const CACHE = 'vinwin-v2';
const STATIC = [
  '/index.html',
  '/manifest.json',
  '/favicon-64.png',
  '/apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - App shell (/, /index.html, /recipe/*, /stats): NETWORK-FIRST, cache fallback
// - recipes.json: network-first, cache fallback
// - Firebase / gstatic: network-only (pass through)
// - Everything else: cache-first
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('firebase') || url.hostname.includes('gstatic.com')) return;

  const isShell = url.pathname === '/' || url.pathname === '/index.html'
    || url.pathname.startsWith('/recipe/') || url.pathname === '/stats';

  if (isShell) {
    e.respondWith(
      fetch('/index.html')
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put('/index.html', clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

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

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
