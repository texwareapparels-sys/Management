const CACHE_NAME = 'texware-pwa-v5';

const PRECACHE_ASSETS = [
  '/',
  '/?mode=worker',
  '/?mode=admin',
  '/texwareworker',
  '/manifest.json',
  '/worker-manifest.json',
  '/manifest.webmanifest',
  '/worker-manifest.webmanifest',
  '/favicon.png',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/apple-touch-icon.png'
];

// Install: Precache shell assets & skip waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('PWA Precache warning (some assets failed, continuing):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for navigation & API, Cache-first for images & icons
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and external chrome extensions / firebase websockets
  if (req.method !== 'GET') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) return;

  // Navigation requests: Network-first with cache fallback (serves index.html for SPA routes)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        // If user is navigating to /texwareworker offline
        if (url.pathname.includes('worker')) {
          return caches.match('/texwareworker').then((res) => res || caches.match('/'));
        }
        return caches.match('/').then((res) => res || caches.match(req));
      })
    );
    return;
  }

  // Static images, fonts, icons: Stale-While-Revalidate
  if (
    req.destination === 'image' ||
    req.destination === 'font' ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return networkRes;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: Network-first with fallback to cache
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200 && req.url.startsWith(self.location.origin)) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkRes;
      })
      .catch(() => caches.match(req))
  );
});
