// TrackAll Service Worker v2
const CACHE = 'trackall-v2';
const IMG = CACHE + '-img';
const SHELL = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== IMG).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Guarda uma cópia SEM nunca rebentar (o clone tem de ser feito de forma síncrona)
function putSafe(cacheName, request, response) {
  try {
    const copy = response.clone();
    caches.open(cacheName).then(c => c.put(request, copy)).catch(() => {});
  } catch (_) { /* corpo já usado: ignora */ }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Nunca em cache: Supabase, APIs, workers e serviços Google (exceto fontes)
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('api.themoviedb.org') ||
      url.hostname.includes('graphql.anilist.co') ||
      url.hostname.includes('workers.dev') ||
      (url.hostname.includes('google') && !isFont)) {
    return;
  }

  // Capas: stale-while-revalidate
  if (req.destination === 'image' || /\.(jpg|jpeg|png|webp|gif)$/i.test(url.pathname)) {
    e.respondWith(
      caches.open(IMG).then(async cache => {
        const cached = await cache.match(req);
        const network = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) { try { cache.put(req, res.clone()); } catch (_) {} }
          return res;
        }).catch(() => cached || Response.error());
        return cached || network;
      })
    );
    return;
  }

  // JS/CSS/fontes: cache-first
  if (['script', 'style', 'font'].includes(req.destination)) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.ok) putSafe(CACHE, req, res);
          return res;
        });
      })
    );
    return;
  }

  // Navegação: network-first, fallback para cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(async () => (await caches.match('/index.html')) || (await caches.match('/')) || Response.error())
    );
  }
});
