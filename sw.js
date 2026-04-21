const CACHE_NAME = 'webagente-cache-v2';
const SW_SCOPE_PATH = self.location.pathname.replace(/sw\.js$/, '');
const INDEX_FALLBACK = `${SW_SCOPE_PATH}index.html`;
const APP_SHELL = [
  INDEX_FALLBACK,
  `${SW_SCOPE_PATH}manifest.webmanifest`,
  `${SW_SCOPE_PATH}icons/icon-192.png`,
  `${SW_SCOPE_PATH}icons/icon-512.png`,
  `${SW_SCOPE_PATH}icons/apple-touch-icon.png`
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // For app navigation (HTML), prefer network to avoid stale shell on PWA installs.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone()).catch(() => undefined);
        return networkResponse;
      } catch {
        const cachedNavigation = await caches.match(request);
        if (cachedNavigation) {
          return cachedNavigation;
        }
        const fallbackIndex = await caches.match(INDEX_FALLBACK);
        if (fallbackIndex) {
          return fallbackIndex;
        }
        throw new Error('Offline and no cached navigation available');
      }
    })());
    return;
  }

  // Never cache API responses through this generic PWA cache.
  if (url.pathname.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Revalidate in background so static assets get fresher over time.
        fetch(request)
          .then((response) => caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())))
          .catch(() => undefined);
        return cached;
      }

      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
        return response;
      });
    })
  );
});
