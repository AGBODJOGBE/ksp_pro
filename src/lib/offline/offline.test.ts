import { clearAccountData, OFFLINE_DATABASE } from '@/lib/api/account-data';
import { closeOfflineDatabase } from './db';
import { stubIndexedDb } from './fake-indexeddb.test-utils';
import {
  addEntry,
  listEntries,
  type NewOutboxEntry,
  patchEntry,
  removeEntry,
  subscribeOutbox,
} from './outbox';
import { pruneToday, readToday, saveToday, TODAY_MAX_AGE_MS } from './today';

const NOW = Date.parse('2026-11-26T09:00:00Z');

const entry = (overrides: Partial<NewOutboxEntry> = {}): NewOutboxEntry => ({
  userId: 'u1',
  group: 'session:s1',
  type: 'session.arrive',
  body: { occurredAt: '2026-11-26T08:55:00.000Z' },
  key: 'cle-00000001',
  occurredAt: Date.parse('2026-11-26T08:55:00Z'),
  files: [],
  ...overrides,
});

afterEach(async () => {
  await closeOfflineDatabase();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('tâches du jour (magasin today)', () => {
  it('garde une copie par compte, lisible 48 h au plus', async () => {
    stubIndexedDb();
    await saveToday('u1', 'planning', { data: [1, 2] }, NOW);

    expect(await readToday('u1', 'planning', NOW + 3_600_000)).toEqual({
      data: { data: [1, 2] },
      savedAt: NOW,
    });
    expect(await readToday('u2', 'planning', NOW)).toBeNull();
    expect(await readToday('u1', 'planning', NOW + TODAY_MAX_AGE_MS + 1)).toBeNull();
  });

  it('la purge retire les copies trop vieilles et celles d’un autre compte', async () => {
    const fake = stubIndexedDb();
    await saveToday('u1', 'visit:v1', { id: 'v1' }, NOW - TODAY_MAX_AGE_MS - 1);
    await saveToday('u1', 'session:s1', { id: 's1' }, NOW);
    await saveToday('u2', 'planning', { data: [] }, NOW);

    await pruneToday('u1', NOW);

    const keys = [...(fake.databases.get(OFFLINE_DATABASE)?.stores.get('today')?.records.keys() ?? [])];
    expect(keys).toEqual(['u1:session:s1']);
  });

  it('sans IndexedDB (navigation privée) : rien n’est gardé, rien ne casse', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(saveToday('u1', 'planning', {}, NOW)).resolves.toBeUndefined();
    expect(await readToday('u1', 'planning', NOW)).toBeNull();
  });
});

describe('actions en attente (magasin outbox)', () => {
  it('garde les gestes dans leur ordre, par compte, avec leur photo', async () => {
    stubIndexedDb();
    const photo = new Blob(['jpeg'], { type: 'image/jpeg' });
    const first = await addEntry(entry());
    const second = await addEntry(
      entry({
        type: 'session.photo',
        key: 'cle-00000002',
        files: [{ field: 'fileId', blob: photo, name: 'a.jpg' }],
      }),
    );
    await addEntry(entry({ userId: 'u2', key: 'cle-00000003' }));

    const entries = await listEntries('u1');
    expect(entries.map((item) => item.id)).toEqual([first, second]);
    expect(entries[0]).toMatchObject({ status: 'pending', error: null, attempts: 0, key: 'cle-00000001' });
    expect(entries[1]?.files[0]?.blob).toBe(photo);
  });

  it('une mise à jour ne recrée jamais une action retirée', async () => {
    stubIndexedDb();
    const id = await addEntry(entry());
    await patchEntry(id, { attempts: 2 });
    expect((await listEntries('u1'))[0]?.attempts).toBe(2);

    await removeEntry(id);
    await patchEntry(id, { status: 'error' });
    expect(await listEntries('u1')).toEqual([]);
  });

  it('prévient les écrans à chaque changement', async () => {
    stubIndexedDb();
    const listener = vi.fn();
    const stop = subscribeOutbox(listener);
    const id = await addEntry(entry());
    await removeEntry(id);
    stop();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('déconnexion : la base est supprimée sans être bloquée par la connexion ouverte', async () => {
    const fake = stubIndexedDb();
    await addEntry(entry());
    await saveToday('u1', 'planning', { data: [] }, NOW);

    await clearAccountData();

    expect(fake.blocked).toEqual([]);
    expect(fake.databases.has(OFFLINE_DATABASE)).toBe(false);
    // La prochaine lecture rouvre une base vide.
    expect(await listEntries('u1')).toEqual([]);
    expect(await readToday('u1', 'planning', NOW)).toBeNull();
  });
});
