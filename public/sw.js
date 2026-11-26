/*
 * Service worker de KSP Pro (F-022), écrit à la main, sans dépendance (≤ 5 Ko).
 * - Pages : réseau d'abord ; sans réseau, la copie gardée ; sinon /hors-ligne.
 * - /_next/static et /icons : cache d'abord (fichiers versionnés).
 * - Jamais l'API ni le stockage des fichiers (autres origines), ni /api du site : les tâches du jour
 *   viennent d'IndexedDB. Coques de terrain gardées dès l'installation (ouverture hors connexion).
 * Changer VERSION efface les anciens caches à l'activation.
 */
const VERSION = 'v2';
const PREFIX = 'ksp-pro-';
const PAGES = PREFIX + 'pages-' + VERSION;
const ASSETS = PREFIX + 'assets-' + VERSION;
const OFFLINE = '/hors-ligne';
const PRECACHE = [OFFLINE, '/', '/agent', '/agent/visite', '/agent/seance', '/agent/envois'];
const LIMITS = { [PAGES]: 40, [ASSETS]: 200 };
const TIMEOUT_MS = 5000;

/** Stratégie d'une requête : 'page', 'asset', ou null (le navigateur s'en charge seul). */
function strategyFor(request) {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return null;
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) return 'asset';
  if (request.mode === 'navigate') return 'page';
  return null;
}

/** Clé d'une page : son chemin, sans la recherche (l'identifiant d'une fiche est lu par la page). */
const pageKey = (url) => new URL(url).pathname;

const cacheable = (response) =>
  response.ok && response.type === 'basic' && !/no-store/.test(response.headers.get('Cache-Control') || '');

async function trim(name) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - LIMITS[name]))) await cache.delete(key);
}

async function put(name, key, response) {
  const cache = await caches.open(name);
  await cache.put(key, response);
  await trim(name);
}

/** Met en cache une page et les fichiers qu'elle appelle (styles, scripts, police). */
async function precachePage(path) {
  const response = await fetch(path, { cache: 'reload' });
  if (!cacheable(response)) return;
  const html = await response.clone().text();
  await put(PAGES, path, response);
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s)?#\\]+/g) || []);
  const cache = await caches.open(ASSETS);
  await Promise.all(
    [...assets].map((asset) =>
      cache.match(asset).then((hit) => hit || cache.add(asset).catch(() => undefined)),
    ),
  );
}

async function page(event) {
  const key = pageKey(event.request.url);
  const cached = () => caches.match(key, { ignoreVary: true });
  const network = fetch(event.request).then((response) => {
    if (cacheable(response)) event.waitUntil(put(PAGES, key, response.clone()));
    return response;
  });
  network.catch(() => undefined);
  // Réseau lent : passé le délai, la copie gardée s'affiche (la réponse attendue la remplacera).
  const slow = new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS))
    .then(cached)
    .then((hit) => hit || network);
  try {
    return await Promise.race([network, slow]);
  } catch {
    return (await cached()) || (await caches.match(OFFLINE, { ignoreVary: true })) || Response.error();
  }
}

async function asset(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (cacheable(response)) await put(ASSETS, request, response.clone());
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all(PRECACHE.map((path) => precachePage(path).catch(() => undefined))).then(() =>
      self.skipWaiting(),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(PREFIX) && name !== PAGES && name !== ASSETS)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const strategy = strategyFor(event.request);
  if (strategy === 'page') event.respondWith(page(event));
  else if (strategy === 'asset') event.respondWith(asset(event.request));
});
