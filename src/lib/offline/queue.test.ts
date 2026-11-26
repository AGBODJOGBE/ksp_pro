import { ApiError } from '@/lib/api/errors';
import { closeOfflineDatabase } from './db';
import { stubIndexedDb } from './fake-indexeddb.test-utils';
import { addEntry, listEntries, type NewOutboxEntry, type OutboxEntry } from './outbox';
import { classifyFailure, drainOutbox } from './queue';

let serial = 0;
const entry = (group: string, type: string): NewOutboxEntry => {
  serial += 1;
  return {
    userId: 'u1',
    group,
    type,
    body: { occurredAt: '2026-11-26T08:55:00.000Z' },
    key: `cle-${String(serial).padStart(8, '0')}`,
    occurredAt: Date.parse('2026-11-26T08:55:00Z'),
    files: [],
  };
};

const refused = (status: number, code: string, details: Record<string, unknown> = {}) =>
  new ApiError(status, code, 'Refusé.', details, 'c-1');

beforeEach(() => {
  serial = 0;
  stubIndexedDb();
});
afterEach(async () => {
  await closeOfflineDatabase();
  vi.unstubAllGlobals();
});

describe('nature d’un échec', () => {
  it.each([
    [ApiError.network(), 'transient'],
    [refused(503, 'GATEWAY_UNAVAILABLE'), 'transient'],
    [refused(429, 'GATEWAY_RATE_LIMITED'), 'transient'],
    [refused(401, 'GATEWAY_TOKEN_INVALID'), 'auth'],
    [refused(403, 'CLEANING_TEAM_LEAD_ONLY'), 'forbidden'],
    [refused(422, 'CLEANING_INVALID_TRANSITION'), 'rejected'],
    [refused(409, 'CLEANING_IDEMPOTENCY_KEY_REUSED'), 'rejected'],
    [refused(400, 'CLEANING_VALIDATION_FAILED', { field: 'occurredAt', reason: 'too_old' }), 'rejected'],
    [ApiError.invalidResponse(), 'rejected'],
    [new Error('Blob illisible'), 'rejected'],
  ])('%s → %s', (error, kind) => {
    expect(classifyFailure(error)).toBe(kind);
  });
});

describe('rejeu de la file', () => {
  it('envoie une action à la fois, dans l’ordre des gestes, avec la clé gardée', async () => {
    await addEntry(entry('session:s1', 'session.arrive'));
    await addEntry(entry('visit:v1', 'visit.arrive'));
    await addEntry(entry('session:s1', 'session.photo'));
    const sent: string[] = [];
    let active = 0;
    const send = vi.fn(async (item: OutboxEntry) => {
      active += 1;
      expect(active).toBe(1);
      await Promise.resolve();
      sent.push(`${item.type} ${item.key}`);
      active -= 1;
      return { ok: true };
    });

    expect(await drainOutbox({ userId: 'u1', send })).toBe('empty');
    expect(sent).toEqual([
      'session.arrive cle-00000001',
      'visit.arrive cle-00000002',
      'session.photo cle-00000003',
    ]);
    expect(await listEntries('u1')).toEqual([]);
  });

  it('un refus bloque la suite de sa séance, pas les autres interventions', async () => {
    await addEntry(entry('session:s1', 'session.start'));
    await addEntry(entry('session:s1', 'session.checklist'));
    await addEntry(entry('visit:v1', 'visit.arrive'));
    const failed = vi.fn();
    const send = vi.fn(async (item: OutboxEntry) => {
      if (item.type === 'session.start') throw refused(422, 'CLEANING_SESSION_OVERDUE_PAYMENT');
      return {};
    });

    expect(await drainOutbox({ userId: 'u1', send, onFailed: failed })).toBe('empty');
    expect(send.mock.calls.map(([item]) => item.type)).toEqual(['session.start', 'visit.arrive']);
    const left = await listEntries('u1');
    expect(left.map((item) => [item.type, item.status])).toEqual([
      ['session.start', 'error'],
      ['session.checklist', 'pending'],
    ]);
    expect(left[0]?.error).toMatchObject({
      status: 422,
      code: 'CLEANING_SESSION_OVERDUE_PAYMENT',
      correlationId: 'c-1',
    });
    expect(failed).toHaveBeenCalledOnce();
  });

  it('réseau coupé : arrêt, l’action reste en attente et sera réessayée telle quelle', async () => {
    await addEntry(entry('session:s1', 'session.arrive'));
    const send = vi.fn().mockRejectedValueOnce(ApiError.network()).mockResolvedValue({});

    expect(await drainOutbox({ userId: 'u1', send })).toBe('offline');
    const [kept] = await listEntries('u1');
    expect(kept).toMatchObject({ status: 'pending', attempts: 1, key: 'cle-00000001' });

    expect(await drainOutbox({ userId: 'u1', send })).toBe('empty');
    expect(send.mock.calls[1]?.[0]).toMatchObject({ key: 'cle-00000001' });
  });

  it('401 après renouvellement : arrêt (se reconnecter), rien n’est perdu', async () => {
    await addEntry(entry('session:s1', 'session.arrive'));
    const send = vi.fn().mockRejectedValue(refused(401, 'GATEWAY_TOKEN_INVALID'));

    expect(await drainOutbox({ userId: 'u1', send })).toBe('auth');
    expect((await listEntries('u1'))[0]?.status).toBe('pending');
  });

  it('403 : l’action est refusée et la file s’arrête', async () => {
    await addEntry(entry('session:s1', 'session.arrive'));
    await addEntry(entry('visit:v1', 'visit.arrive'));
    const send = vi.fn().mockRejectedValue(refused(403, 'GATEWAY_FORBIDDEN'));

    expect(await drainOutbox({ userId: 'u1', send })).toBe('forbidden');
    expect(send).toHaveBeenCalledOnce();
    expect((await listEntries('u1')).map((item) => item.status)).toEqual(['error', 'pending']);
  });

  it('un seul rejeu à la fois', async () => {
    await addEntry(entry('session:s1', 'session.arrive'));
    let release: () => void = () => undefined;
    const send = vi.fn(() => new Promise((resolve) => (release = () => resolve({}))));

    const first = drainOutbox({ userId: 'u1', send });
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    expect(await drainOutbox({ userId: 'u1', send })).toBe('busy');
    release();
    expect(await first).toBe('empty');
  });
});
