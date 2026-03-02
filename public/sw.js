// TrackAll Service Worker v1
const CACHE = 'trackall-v1';
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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== CACHE+'-img').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never cache: Supabase, APIs, workers
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('api.themoviedb.org') ||
      url.hostname.includes('graphql.anilist.co') ||
      url.hostname.includes('workers.dev') ||
      url.hostname.includes('google')) {
    return;
  }

  // Cover images: stale-while-revalidate (fast loads + fresh)
  if (e.request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
    e.respondWith(
      caches.open(CACHE + '-img').then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // JS/CSS/fonts: cache-first
  if (['script', 'style', 'font'].includes(e.request.destination)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // Navigation: network-first, fallback to cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match('/index.html') || caches.match('/')
      )
    );
  }
});
