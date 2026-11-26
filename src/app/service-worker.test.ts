// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

/**
 * Service worker écrit à la main (`public/sw.js`, F-022), chargé tel quel dans un bac à sable : `self`,
 * `caches` et `fetch` simulés, événements déclenchés à la main.
 */

const SOURCE = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');
const ORIGIN = 'https://pro.ksp.bj';
const GATEWAY = 'https://api.ksp.bj';

type FakeRequest = { url: string; method: string; mode: string };
type Key = string | { url: string };
const keyOf = (key: Key) => new URL(typeof key === 'string' ? key : key.url, ORIGIN).href;

const HTML = (title: string) =>
  `<html><head><link rel="stylesheet" href="/_next/static/css/app.css"><script src="/_next/static/chunks/main.js"></script></head><body>${title}<script>self.__next_f.push("\\"/_next/static/chunks/page.js\\"")</script></body></html>`;

function html(title: string, headers: Record<string, string> = {}) {
  return new Response(HTML(title), { status: 200, headers: { 'Content-Type': 'text/html', ...headers } });
}

/** Réponse « basic » (même origine), comme celles que reçoit un vrai service worker. */
function basic(response: Response): Response {
  Object.defineProperty(response, 'type', { value: 'basic' });
  return response;
}

function setup(options: { online?: boolean; pages?: Record<string, () => Response> } = {}) {
  const net = {
    online: options.online ?? true,
    calls: [] as string[],
    pages: options.pages ?? {},
    hang: false,
  };
  const fetchMock = vi.fn(async (input: Key) => {
    const url = keyOf(input);
    net.calls.push(url);
    if (net.hang) return new Promise<Response>(() => undefined);
    if (!net.online) throw new TypeError('Failed to fetch');
    const path = new URL(url).pathname;
    const page = net.pages[path];
    if (page) return basic(page());
    if (path.startsWith('/_next/static/') || path.startsWith('/icons/'))
      return basic(new Response(`contenu de ${path}`, { status: 200 }));
    return basic(html(`page ${path}`));
  });

  class FakeCache {
    readonly store = new Map<string, Response>();
    async match(key: Key) {
      return this.store.get(keyOf(key))?.clone();
    }
    async put(key: Key, response: Response) {
      this.store.set(keyOf(key), response);
    }
    async add(key: Key) {
      this.store.set(keyOf(key), await fetchMock(key));
    }
    async keys() {
      return [...this.store.keys()].map((url) => ({ url }));
    }
    async delete(key: Key) {
      return this.store.delete(keyOf(key));
    }
  }
  const stores = new Map<string, FakeCache>();
  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new FakeCache());
      return stores.get(name)!;
    },
    async match(key: Key) {
      for (const cache of stores.values()) {
        const hit = await cache.match(key);
        if (hit) return hit;
      }
      return undefined;
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };

  const listeners = new Map<string, (event: unknown) => void>();
  const timers: Array<() => void> = [];
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  const context = createContext({
    self,
    caches,
    fetch: fetchMock,
    URL,
    Response,
    Promise,
    Set,
    setTimeout: (callback: () => void) => {
      timers.push(callback);
      return 0;
    },
  });
  runInContext(SOURCE, context);

  async function lifecycle(type: 'install' | 'activate') {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)?.({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
    await Promise.all(pending);
  }

  /** Requête vue par le service worker : réponse servie, ou `null` s'il laisse faire le navigateur. */
  async function request(url: string, init: { method?: string; mode?: string } = {}) {
    const pending: Promise<unknown>[] = [];
    let responded: Promise<Response> | null = null;
    const event = {
      request: {
        url: new URL(url, ORIGIN).href,
        method: init.method ?? 'GET',
        mode: init.mode ?? 'cors',
      } as FakeRequest,
      respondWith: (response: Promise<Response>) => {
        responded = response;
      },
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    };
    listeners.get('fetch')?.(event);
    if (!responded) return null;
    const response = await (responded as Promise<Response>);
    await Promise.all(pending);
    return response;
  }

  return { net, stores, caches, self, lifecycle, request, timers, fetchMock };
}

describe('service worker de KSP Pro', () => {
  it('reste sous 5 Ko', () => {
    expect(Buffer.byteLength(SOURCE, 'utf8')).toBeLessThanOrEqual(5 * 1024);
  });

  it('installation : garde la page hors connexion, l’accueil et les coques de terrain, avec leurs fichiers', async () => {
    const sw = setup();
    await sw.lifecycle('install');

    const pages = [...(sw.stores.get('ksp-pro-pages-v2')?.store.keys() ?? [])];
    expect(pages.sort()).toEqual(
      ['/', '/agent', '/agent/envois', '/agent/seance', '/agent/visite', '/hors-ligne'].map(
        (path) => `${ORIGIN}${path}`,
      ),
    );
    const assets = [...(sw.stores.get('ksp-pro-assets-v2')?.store.keys() ?? [])];
    expect(assets).toEqual(
      expect.arrayContaining([
        `${ORIGIN}/_next/static/css/app.css`,
        `${ORIGIN}/_next/static/chunks/main.js`,
        `${ORIGIN}/_next/static/chunks/page.js`,
      ]),
    );
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it('activation : efface les caches des anciennes versions, pas ceux des autres', async () => {
    const sw = setup();
    for (const name of ['ksp-pro-pages-v1', 'ksp-pro-assets-v1', 'ksp-pro-pages-v2', 'autre-cache']) {
      await sw.caches.open(name);
    }
    await sw.lifecycle('activate');

    expect([...sw.stores.keys()].sort()).toEqual(['autre-cache', 'ksp-pro-pages-v2']);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it('ne touche jamais à la gateway, au stockage, à /api ni aux envois', async () => {
    const sw = setup();
    expect(await sw.request(`${GATEWAY}/api/v1/cleaning/agent/me`)).toBeNull();
    expect(await sw.request('https://stockage.ksp.bj/photo.jpg?signature=x')).toBeNull();
    expect(await sw.request('/api/health')).toBeNull();
    expect(await sw.request('/agent', { method: 'POST', mode: 'navigate' })).toBeNull();
    // Données des pages (navigation côté client de Next) : le réseau seulement.
    expect(await sw.request('/agent?_rsc=abc')).toBeNull();
    expect(sw.fetchMock).not.toHaveBeenCalled();
  });

  it('fichiers de /_next/static : cache d’abord', async () => {
    const sw = setup();
    const first = await sw.request('/_next/static/chunks/app.js');
    expect(await first?.text()).toBe('contenu de /_next/static/chunks/app.js');

    sw.net.online = false;
    const second = await sw.request('/_next/static/chunks/app.js');
    expect(await second?.text()).toBe('contenu de /_next/static/chunks/app.js');
    expect(sw.net.calls).toHaveLength(1);
  });

  it('pages : réseau d’abord, puis la copie gardée sans réseau (même avec une autre recherche)', async () => {
    const sw = setup();
    expect(await (await sw.request('/agent/seance?id=1', { mode: 'navigate' }))?.text()).toContain(
      'page /agent/seance',
    );

    sw.net.online = false;
    const offline = await sw.request('/agent/seance?id=2', { mode: 'navigate' });
    expect(await offline?.text()).toContain('page /agent/seance');
  });

  it('page jamais ouverte et pas de réseau : la page hors connexion', async () => {
    const sw = setup();
    await sw.lifecycle('install');
    sw.net.online = false;

    const response = await sw.request('/partenaire', { mode: 'navigate' });
    expect(await response?.text()).toContain('page /hors-ligne');
  });

  it('une page servie en no-store (lien d’invitation) n’est jamais gardée', async () => {
    const sw = setup({
      pages: { '/invitations/abc': () => html('invitation', { 'Cache-Control': 'private, no-store' }) },
    });
    await sw.request('/invitations/abc', { mode: 'navigate' });
    expect(sw.stores.get('ksp-pro-pages-v2')?.store.has(`${ORIGIN}/invitations/abc`) ?? false).toBe(false);
  });

  it('réseau très lent : passé le délai, la copie gardée s’affiche', async () => {
    const sw = setup();
    await sw.request('/agent', { mode: 'navigate' });
    sw.net.hang = true;

    const pending = sw.request('/agent', { mode: 'navigate' });
    await vi.waitFor(() => expect(sw.timers.length).toBeGreaterThan(0));
    sw.timers.at(-1)?.();
    expect(await (await pending)?.text()).toContain('page /agent');
  });
});
