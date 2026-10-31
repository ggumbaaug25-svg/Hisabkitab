const CACHE_NAME = 'hisaab-kitab-v2';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Add files one by one so a single missing file cannot break the install.
      Promise.all(APP_SHELL.map(f => cache.add(f).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Never touch the Apps Script API or any non-GET request.
  if (req.method !== 'GET' || url.hostname.includes('script.google.com')) return;

  const isPage = req.mode === 'navigate' || req.destination === 'document';

  if (isPage) {
    // Network first for the page, so fixes reach users right away. Cache is the offline fallback.
    event.respondWith(
      fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', copy));
        }
        return res;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Cache first for everything else (icons, manifest, fonts).
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.ok && (url.origin === self.location.origin || url.hostname.includes('gstatic.com') || url.hostname.includes('googleapis.com'))) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
