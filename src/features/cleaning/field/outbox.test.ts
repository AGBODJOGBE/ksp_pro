import { session } from '@/lib/api';
import { AGENT_PERMS, errorBody, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { closeOfflineDatabase } from '@/lib/offline/db';
import { stubIndexedDb } from '@/lib/offline/fake-indexeddb.test-utils';
import { listEntries } from '@/lib/offline/outbox';
import {
  ARRIVAL,
  photoBody,
  SESSION_ID,
  sessionViewBody,
  uploadRoutes,
  VISIT_ID,
  visitBody,
} from '@/features/cleaning/cleaning.test-utils';
import { alreadyDone, requestBody } from './actions';
import { deadlineOf, nearDeadline } from './deadline';
import { flushOutbox, retryEntry, submitFieldAction } from './outbox';

const USER = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11';
const S = `/api/v1/cleaning/sessions/${SESSION_ID}`;
const V = `/api/v1/cleaning/visits/${VISIT_ID}`;
const KEY = /^[A-Za-z0-9_-]{8,100}$/;

const offline = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
const online = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

const sessionAction = (type: string, body: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  userId: USER,
  kind: 'session' as const,
  targetId: SESSION_ID,
  type: type as Parameters<typeof submitFieldAction>[0]['type'],
  body,
  ...extra,
});

beforeEach(async () => {
  stubIndexedDb();
  await session.clear();
  session.set(
    sessionBody({ profileIncomplete: false, perms: AGENT_PERMS }) as Parameters<typeof session.set>[0],
  );
});

afterEach(async () => {
  await closeOfflineDatabase();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('geste de terrain en ligne', () => {
  it('part aussitôt avec sa clé et son heure réelle, puis sort de la file', async () => {
    online();
    const { calls } = stubGateway({
      [`POST ${V}/arrive`]: { status: 200, body: visitBody({ status: 'in_progress', arrival: ARRIVAL }) },
    });
    const body = {
      latitude: 6.4484,
      longitude: 2.3558,
      accuracyMeters: 12,
      occurredAt: '2026-11-26T08:58:00.000Z',
    };

    const outcome = await submitFieldAction({
      userId: USER,
      kind: 'visit',
      targetId: VISIT_ID,
      type: 'visit.arrive',
      body,
    });

    expect(outcome).toMatchObject({ status: 'sent', view: { status: 'in_progress' } });
    expect(calls[0]?.body).toEqual(body);
    expect(calls[0]?.headers['Idempotency-Key']).toMatch(KEY);
    expect(await listEntries(USER)).toEqual([]);
  });

  it('refusé : l’issue porte l’explication et l’action à retirer', async () => {
    online();
    stubGateway({
      [`POST ${S}/start`]: {
        status: 422,
        body: errorBody('CLEANING_SESSION_OVERDUE_PAYMENT', 'Une séance précédente est impayée.'),
      },
    });
    const outcome = await submitFieldAction(
      sessionAction('session.start', { occurredAt: '2026-11-26T09:01:00.000Z' }),
    );
    expect(outcome).toMatchObject({ status: 'failed', error: { code: 'CLEANING_SESSION_OVERDUE_PAYMENT' } });
    expect(outcome.status === 'failed' && typeof outcome.entryId).toBe('number');
  });
});

describe('hors connexion', () => {
  it('gestes gardés tels quels, puis rejoués dans l’ordre avec les mêmes clés au retour du réseau', async () => {
    offline();
    const photo = new Blob(['jpeg'], { type: 'image/jpeg' });
    const gestures = [
      sessionAction('session.arrive', { occurredAt: '2026-11-26T08:50:00.000Z' }),
      sessionAction(
        'session.photo',
        { kind: 'before', occurredAt: '2026-11-26T08:52:00.000Z' },
        { files: [{ field: 'fileId', blob: photo, name: 'avant.jpg' }] },
      ),
      sessionAction('session.start', { occurredAt: '2026-11-26T09:00:00.000Z' }),
      sessionAction('session.checklist', {
        items: [{ code: 'sol_balayage', checked: true, cleaningTypeCode: 'sol' }],
        occurredAt: '2026-11-26T09:20:00.000Z',
      }),
    ];
    for (const gesture of gestures) expect(await submitFieldAction(gesture)).toEqual({ status: 'queued' });
    const kept = await listEntries(USER);
    expect(kept.map((entry) => entry.type)).toEqual([
      'session.arrive',
      'session.photo',
      'session.start',
      'session.checklist',
    ]);
    expect(new Set(kept.map((entry) => entry.key)).size).toBe(4);

    online();
    const view = sessionViewBody();
    const { calls } = stubGateway({
      [`POST ${S}/arrive`]: { status: 200, body: { ...view, arrival: ARRIVAL } },
      ...uploadRoutes(['f1']),
      [`POST ${S}/photos`]: { status: 200, body: { ...view, photos: [photoBody('f1', 'before')] } },
      [`POST ${S}/start`]: {
        status: 200,
        body: { ...view, status: 'in_progress', startedAt: '2026-11-26T09:00:00Z' },
      },
      [`PATCH ${S}/checklist`]: { status: 200, body: { ...view, status: 'in_progress' } },
    });
    await flushOutbox(USER);

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `POST ${S}/arrive`,
      'POST /api/v1/file/uploads',
      'PUT /ksp-files/f1',
      'POST /api/v1/file/files/f1/complete',
      `POST ${S}/photos`,
      `POST ${S}/start`,
      `PATCH ${S}/checklist`,
    ]);
    const actions = calls.filter((call) => call.path.startsWith(S));
    expect(actions.map((call) => call.headers['Idempotency-Key'])).toEqual(kept.map((entry) => entry.key));
    expect(actions.map((call) => call.body)).toEqual([
      gestures[0]?.body,
      { kind: 'before', occurredAt: '2026-11-26T08:52:00.000Z', fileId: 'f1' },
      gestures[2]?.body,
      gestures[3]?.body,
    ]);
    expect(await listEntries(USER)).toEqual([]);
  });

  it('photo déposée mais pas rattachée (panne) : le nouvel essai garde le fichier et la clé', async () => {
    online();
    const first = stubGateway({
      ...uploadRoutes(['f1']),
      [`POST ${S}/photos`]: { status: 503, body: errorBody('GATEWAY_UNAVAILABLE', 'Service indisponible.') },
    });
    const outcome = await submitFieldAction(
      sessionAction(
        'session.photo',
        { kind: 'after', occurredAt: '2026-11-26T10:00:00.000Z' },
        { files: [{ field: 'fileId', blob: new Blob(['x'], { type: 'image/jpeg' }), name: 'apres.jpg' }] },
      ),
    );
    expect(outcome).toEqual({ status: 'queued' });
    const [kept] = await listEntries(USER);
    expect(kept?.files[0]?.fileId).toBe('f1');
    const key = first.calls.at(-1)?.headers['Idempotency-Key'];

    const second = stubGateway({
      [`POST ${S}/photos`]: { status: 200, body: sessionViewBody({ photos: [photoBody('f1', 'after')] }) },
    });
    await flushOutbox(USER);
    expect(second.calls.map((call) => call.path)).toEqual([`${S}/photos`]);
    expect(second.calls[0]?.headers['Idempotency-Key']).toBe(key);
    expect(await listEntries(USER)).toEqual([]);
  });
});

describe('réponses du rejeu', () => {
  async function queue(type: string, body: Record<string, unknown>) {
    offline();
    await submitFieldAction(sessionAction(type, body));
    online();
  }

  it('422 transition invalide : la fiche est relue ; déjà faite, l’action sort de la file', async () => {
    await queue('session.start', { occurredAt: '2026-11-26T09:00:00.000Z' });
    const { calls } = stubGateway({
      [`POST ${S}/start`]: {
        status: 422,
        body: errorBody('CLEANING_INVALID_TRANSITION', 'Action impossible.'),
      },
      [`GET /api/v1/cleaning/agent/sessions/${SESSION_ID}`]: {
        status: 200,
        body: sessionViewBody({ status: 'in_progress', startedAt: '2026-11-26T09:00:00Z' }),
      },
    });
    await flushOutbox(USER);
    expect(calls.map((call) => call.method)).toEqual(['POST', 'GET']);
    expect(await listEntries(USER)).toEqual([]);
  });

  it('422 transition invalide, action pas faite : l’action reste, en erreur', async () => {
    await queue('session.start', { occurredAt: '2026-11-26T09:00:00.000Z' });
    stubGateway({
      [`POST ${S}/start`]: {
        status: 422,
        body: errorBody('CLEANING_INVALID_TRANSITION', 'Action impossible.'),
      },
      [`GET /api/v1/cleaning/agent/sessions/${SESSION_ID}`]: {
        status: 200,
        body: sessionViewBody({ status: 'cancelled' }),
      },
    });
    await flushOutbox(USER);
    expect((await listEntries(USER))[0]).toMatchObject({
      status: 'error',
      error: { code: 'CLEANING_INVALID_TRANSITION' },
    });
  });

  it('409 clé réutilisée : erreur signalée', async () => {
    await queue('session.arrive', { occurredAt: '2026-11-26T08:50:00.000Z' });
    stubGateway({
      [`POST ${S}/arrive`]: {
        status: 409,
        body: errorBody('CLEANING_IDEMPOTENCY_KEY_REUSED', 'Cette clé a déjà servi.'),
      },
    });
    await flushOutbox(USER);
    expect((await listEntries(USER))[0]?.error?.code).toBe('CLEANING_IDEMPOTENCY_KEY_REUSED');
  });

  it('400 heure dans le futur : l’agent renvoie à l’heure de réception, avec une nouvelle clé', async () => {
    await queue('session.start', { occurredAt: '2026-11-26T09:00:00.000Z' });
    stubGateway({
      [`POST ${S}/start`]: [
        {
          status: 400,
          body: errorBody('CLEANING_VALIDATION_FAILED', 'Valeur refusée.', {
            field: 'occurredAt',
            reason: 'in_future',
          }),
        },
        { status: 200, body: sessionViewBody({ status: 'in_progress', startedAt: '2026-11-26T09:02:00Z' }) },
      ],
    });
    await flushOutbox(USER);
    const [failed] = await listEntries(USER);
    expect(failed?.error?.details).toEqual({ field: 'occurredAt', reason: 'in_future' });

    const { calls } = stubGateway({
      [`POST ${S}/start`]: {
        status: 200,
        body: sessionViewBody({ status: 'in_progress', startedAt: '2026-11-26T09:02:00Z' }),
      },
    });
    await retryEntry(failed!, { withoutTime: true });
    expect(calls[0]?.body).toEqual({});
    expect(calls[0]?.headers['Idempotency-Key']).not.toBe(failed?.key);
    expect(await listEntries(USER)).toEqual([]);
  });

  it('400 action de plus de 72 h : erreur gardée pour l’agent', async () => {
    await queue('session.arrive', { occurredAt: '2026-11-23T08:00:00.000Z' });
    stubGateway({
      [`POST ${S}/arrive`]: {
        status: 400,
        body: errorBody('CLEANING_VALIDATION_FAILED', 'Valeur refusée.', {
          field: 'occurredAt',
          reason: 'too_old',
        }),
      },
    });
    await flushOutbox(USER);
    expect((await listEntries(USER))[0]).toMatchObject({
      status: 'error',
      error: { details: { reason: 'too_old' } },
    });
  });
});

describe('délai de 72 h', () => {
  it('avertit 12 h avant la limite', () => {
    const at = Date.parse('2026-11-23T08:00:00Z');
    expect(nearDeadline(at, at + 59 * 3_600_000)).toBe(false);
    expect(nearDeadline(at, at + 60 * 3_600_000)).toBe(true);
    expect(deadlineOf(at)).toBe('2026-11-26T08:00:00.000Z');
  });
});

describe('fiche relue après un refus', () => {
  it('reconnaît les gestes déjà faits', () => {
    const view = sessionViewBody({
      status: 'in_progress',
      arrival: ARRIVAL,
      startedAt: '2026-11-26T09:00:00Z',
      photos: [photoBody('f1', 'before')],
      checklist: [
        { code: 'sol_balayage', label: 'Sols', cleaningTypeCode: 'sol', checked: true, checkedAt: null },
      ],
    }) as Parameters<typeof alreadyDone>[1];
    const done = (
      type: string,
      body: Record<string, unknown> = {},
      files: Array<{ fileId?: string }> = [],
      ref?: string,
    ) =>
      alreadyDone(
        {
          type,
          body,
          ref,
          files: files.map((file) => ({ field: 'fileId', blob: new Blob(), name: 'a', ...file })),
        },
        view,
      );
    expect(done('session.arrive')).toBe(true);
    expect(done('session.start')).toBe(true);
    expect(done('session.photo', { kind: 'before' }, [{ fileId: 'f1' }])).toBe(true);
    expect(done('session.photo', { kind: 'before' }, [{ fileId: 'f9' }])).toBe(false);
    expect(done('session.photo.remove', {}, [], 'f1')).toBe(false);
    expect(
      done('session.checklist', {
        items: [{ code: 'sol_balayage', checked: true, cleaningTypeCode: 'sol' }],
      }),
    ).toBe(true);
    expect(
      done('session.checklist', {
        items: [{ code: 'sol_balayage', checked: false, cleaningTypeCode: 'sol' }],
      }),
    ).toBe(false);
    expect(done('session.complete')).toBe(false);
  });

  it('le corps envoyé reçoit les photos déposées, dans l’ordre', () => {
    expect(
      requestBody({
        body: { category: 'equipment', note: 'Aspirateur en panne' },
        files: [
          { field: 'photoFileIds', blob: new Blob(), name: 'a', fileId: 'f1' },
          { field: 'photoFileIds', blob: new Blob(), name: 'b', fileId: 'f2' },
        ],
      }),
    ).toEqual({ category: 'equipment', note: 'Aspirateur en panne', photoFileIds: ['f1', 'f2'] });
  });
});
