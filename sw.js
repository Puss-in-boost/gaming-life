// Cache only the public app shell. Personal records remain in browser storage.
const CACHE = 'gaming-life-shell-v4';
const SHELL = ['./', './index.html', './cloud.js', './adventure.css', './manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('gaming-life-shell-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(fetch(req).then(response => {
    if (response.ok && (req.mode === 'navigate' || SHELL.some(path => new URL(path, self.registration.scope).pathname === new URL(req.url).pathname))) {
      const copy = response.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(req).then(found => found || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});