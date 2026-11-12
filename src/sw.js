/* Badyet offline helper. Keeps the app itself on the device so it opens without
   internet. Your data is never stored here: requests to Google are not touched. */
const CACHE = 'badyet-__BUILD__';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest',
  './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-192.png',
  './assets/icon-maskable-512.png', './assets/apple-touch-icon.png', './assets/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('badyet-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // Google, fonts: straight to the network
  if (req.mode === 'navigate') {   // the app page: newest when online, saved copy when offline
    e.respondWith(fetch(req).then(r => {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return r;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
