// FORTIS — CUI Attock Smart Timetable & Academic Companion
// PWA Service Worker: Offline Caching Engine & Push Notification Service
const SW_VERSION = 'fortis-pwa-v2.5';
const SHELL_CACHE = 'fortis-shell-v2.5';
const DATA_CACHE = 'fortis-data-v2.5';

// Essential core shell assets to pre-cache on install for instant offline boot
const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/manifest.json',
  '/crest.png',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/fortis-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => {
        return Promise.allSettled(
          PRECACHE_ASSETS.map((url) =>
            fetch(url, { cache: 'reload' })
              .then((response) => {
                if (response && response.ok) {
                  return cache.put(url, response);
                }
              })
              .catch(() => {})
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== SHELL_CACHE && name !== DATA_CACHE)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event: Intelligent Offline Fallback & Stale-While-Revalidate Caching
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle HTTP/HTTPS GET requests
  if (req.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // 1. Navigation requests (HTML document) -> Network-first with fast fallback to cached index
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(async () => {
          // Offline in basement or weak signal: serve cached page shell
          const cached = await caches.match('/');
          if (cached) return cached;
          const fallback = await caches.match(req);
          if (fallback) return fallback;
          return new Response(
            `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>FORTIS — Offline Mode</title><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;padding:2rem;font-family:system-ui,-apple-system,sans-serif;background:#0d1e28;color:#f1f5f9;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center}h1{font-size:1.75rem;margin:0 0 0.5rem;color:#14b8a6}p{color:#94a3b8;max-width:400px;line-height:1.5;margin:0 0 1.5rem}.btn{background:#087f79;color:#fff;border:none;padding:0.75rem 1.5rem;border-radius:0.75rem;font-weight:700;cursor:pointer}</style></head><body><h1>⚡ FORTIS Offline Mode</h1><p>Your network connection appears to be offline. Reconnect or tap retry to load your cached timetable.</p><button class="btn" onclick="window.location.reload()">Retry Connection</button></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // 2. Static Assets (JS chunks, CSS stylesheets, web fonts, images) -> Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.woff2') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. API / RPC / Timetable Server Functions -> Network-first with cached data fallback
  if (url.pathname.startsWith('/_server/') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'offline', offline: true }), {
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  // 4. Fallback for all other assets: Cache-first with network fallback
  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req)
          .then((resp) => {
            if (resp && resp.status === 200) {
              const copy = resp.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
            }
            return resp;
          })
          .catch(() => cached)
      );
    })
  );
});

// =========================================================================
// Web Push Notifications & Notification Clicks
// =========================================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client && targetUrl && targetUrl !== '/') {
              client.navigate(targetUrl);
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener('push', (event) => {
  let title = '🔔 CUI Attock Class Alert';
  let options = {
    body: 'Upcoming lecture reminder',
    icon: '/crest.png',
    badge: '/crest.png',
    vibrate: [200, 100, 200],
    data: { url: '/' },
    tag: 'cui-class-reminder',
    renotify: true,
  };

  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      options = {
        ...options,
        ...data,
        icon: data.icon || '/crest.png',
        badge: data.badge || '/crest.png',
        vibrate: data.vibrate || [200, 100, 200],
        data: data.data || { url: '/' },
      };
    } catch {
      options.body = event.data.text() || options.body;
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
