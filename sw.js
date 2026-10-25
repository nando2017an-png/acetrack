// Naikkan versi ini setiap kali file aplikasi diubah.
const VERSION = 'acetrack-v4';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' melewati cache HTTP GitHub Pages (10 menit), supaya yang tersimpan benar-benar versi baru.
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // API GitHub (backup) tidak pernah di-cache.
  if (url.hostname === 'api.github.com') return;
  if (url.origin === location.origin) {
    // File aplikasi: ambil dari internet dulu supaya update langsung terpakai, pakai cache kalau offline.
    // Pakai URL (bukan req) karena request navigasi tidak boleh diberi opsi tambahan.
    e.respondWith(fetch(url.href, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  // Font Google: cache dulu.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
