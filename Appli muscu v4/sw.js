// Service worker : cache de l'application pour un fonctionnement hors ligne.
// Stratégie "stale-while-revalidate" : réponse immédiate depuis le cache,
// puis mise à jour silencieuse du cache (visible au lancement suivant).
// Les requêtes ne concernent que les fichiers statiques de l'application elle-même.
const CACHE = 'muscu-v61';
const CORE_FILES = [
  './', 'index.html', 'manifest.json', 'catalogue-exercices-musculation.html', 'catalogue-search-performance.js',
  'styles.css', 'catalogue.css', 'catalogue.js',
  'js/core.js', 'js/views.js', 'js/progress.js', 'js/plan.js', 'js/timer.js', 'js/actions.js', 'js/events.js',
  'catalogue/data/index-v2.json',
  'logo.png', 'apple-touch-icon.png', 'icon-180.png?v=7', 'icon-192.png?v=7', 'icon-512.png?v=7'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async cache => {
    await cache.addAll(CORE_FILES);
    const response = await cache.match('catalogue/data/index-v2.json');
    const index = response && await response.json();
    if (!index || !Array.isArray(index.files) || !index.files.every(file => /^[a-z-]+-\d{2}\.json$/.test(file))) {
      throw new Error('Index des données du catalogue invalide');
    }
    const files = index.files.map(file => `catalogue/data/${file}`);
    const results = await Promise.allSettled(files.map(file => cache.add(file)));
    results.forEach((result, index) => {
      if (result.status === 'rejected') console.error(`Impossible de précacher ${files[index]}.`, result.reason);
    });
    await self.skipWaiting();
  }));
});

self.addEventListener('activate', e => {
  // Supprime les anciens caches lors d'un changement de version
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // jamais de requête vers un autre domaine
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      // Rafraîchit le cache en arrière-plan ; échoue silencieusement hors ligne
      const refresh = fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => null);
      if (hit) return hit;
      return (await refresh) || (await cache.match('./')) || Response.error();
    })
  );
});
