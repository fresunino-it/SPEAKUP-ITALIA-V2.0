// Service Worker — SpeakUp Italia
// Strategia: Cache First per asset statici, Network First per HTML
const CACHE = 'speakup-v2';
const STATIC = [
  '/','/index.html','/style.css','/app.js',
  '/game1.html','/game2.html','/game3.html',
  '/assets/logo.png','/assets/favicon.png','/assets/success.wav',
  '/manifest.json','/404.html'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const isHTML = e.request.headers.get('accept')?.includes('text/html');
  if (isHTML) {
    // Network First per HTML — contenuto sempre aggiornato
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request) || caches.match('/index.html'))
    );
  } else {
    // Cache First per asset
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
  }
});
