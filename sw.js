const CACHE_NAME = 'snake-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './leaderboard.js',
  './animation.js',
  './We Dont Stop.mp3',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png'
];

// Install: cache all core assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for core assets, network-first for API calls (leaderboard)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network-first for Firebase (leaderboard data)
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
