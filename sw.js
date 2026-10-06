/* Tečkovník – service worker: aplikace se načte rychle a otevře se i bez internetu.
   Při každé úpravě souborů zvyš číslo verze, aby si zařízení stáhla novou verzi. */
const VERSION = 'tk-v2';
const SHELL = ['./', './index.html', './config.js', './pwa.js', './vendor/supabase.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fonts) return;            // databáze a ostatní: vždy přímo ze sítě
  const fresh = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname.endsWith('config.js') || url.pathname.endsWith('pwa.js');
  if (fresh){                                                       // nejdřív síť (aktualizace), bez sítě z mezipaměti
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(ca => ca.put(req, c)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {     // nejdřív mezipaměť
    if (r.ok || r.type === 'opaque'){ const c = r.clone(); caches.open(VERSION).then(ca => ca.put(req, c)); }
    return r;
  })));
});
