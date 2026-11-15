'use strict';

const CACHE_NAME = 'forest-explorer-v2';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './src/main.js',
  './src/core/config.js',
  './src/core/state.js',
  './src/utils/dom.js',
  './src/utils/a11y.js',
  './src/utils/formatters.js',
  './src/services/api.js',
  './src/services/audio.js',
  './src/services/hero.js',
  './src/services/i18n.js',
  './src/features/navigation.js',
  './src/features/atlas.js',
  './src/features/map.js',
  './src/features/compare.js',
  './src/features/journal.js',
  './src/features/search.js',
  './src/features/detail.js',
  './src/features/gamification.js',
  './src/features/auth.js',
  './src/features/pwa.js',
  './data/forests.json',
  './data/species.json',
  './data/stories.json',
  './data/discoveries.json',
  './data/prehistoric.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip POST, PUT, DELETE or non-GET
  if (e.request.method !== 'GET') return;

  // Handle API routes: network first, no cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Stale-While-Revalidate for data JSON
  if (url.pathname.endsWith('.json')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(networkRes => {
          if (networkRes && networkRes.status === 200) {
            cache.put(e.request, networkRes.clone());
          }
          return networkRes;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Cache-First for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') {
          return res;
        }
        const toCache = res.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(e.request, toCache);
        });
        return res;
      }).catch(() => {
        // Fallback for HTML documents
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
