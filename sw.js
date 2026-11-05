/*
 * RUN-FORREST-RUN – sw.js (service worker)
 * Filversion: 1.0.0
 * Ändringsnotering:
 *  1.0.0 – Offlinelagring av appskalet efter första laddningen (TRN-NFK-004). Ny version aktiveras inte
 *          automatiskt: den väntar tills appen startas om eller inget pass pågår (TRN-TEK-012).
 * Håll CACHE i takt med appens version (js/version.js).
 */
const CACHE = 'rfr-v1.0.0';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/app.js', './js/audio.js', './js/config.js', './js/i18n.js', './js/storage.js', './js/timeline.js', './js/version.js',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/icon-maskable-512.png', './assets/icons/apple-touch-icon.png',
  './assets/voice/sv/work.mp3', './assets/voice/sv/rest.mp3', './assets/voice/sv/setrest.mp3', './assets/voice/sv/done.mp3',
  './assets/voice/en/work.mp3', './assets/voice/en/rest.mp3', './assets/voice/en/setrest.mp3', './assets/voice/en/done.mp3',
];

self.addEventListener('install', (event) => {
  // Ingen skipWaiting här (TRN-TEK-012). Saknade filer (t.ex. svenska röstfiler) stoppar inte installationen.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok) await cache.put(url, res);
      } catch (e) { /* hoppar över */ }
    }));
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('rfr-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      if (req.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      throw e;
    }
  })());
});
