import { render, screen, waitFor } from '@testing-library/react';
import { session } from '@/lib/api';
import { AGENT_PERMS, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { closeOfflineDatabase } from '@/lib/offline/db';
import { stubIndexedDb } from '@/lib/offline/fake-indexeddb.test-utils';
import { readToday, saveToday } from '@/lib/offline/today';
import {
  agentBody,
  assignmentBody,
  list,
  SESSION_ID,
  sessionViewBody,
  VISIT_ID,
  visitBody,
} from '@/features/cleaning/cleaning.test-utils';
import { AgentToday } from './agent-today';

const USER = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11';
const LIST = 'GET /api/v1/cleaning/agent/me/assignments';
const soon = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

const visitAssignment = assignmentBody({
  assignmentId: 'a-visite',
  target: { kind: 'visit', id: VISIT_ID },
  start: soon(1),
  end: soon(2),
  placeTypeName: 'Villa',
});
const sessionAssignment = assignmentBody({
  assignmentId: 'a-seance',
  target: { kind: 'session', id: SESSION_ID },
  start: soon(2),
  end: soon(3),
  placeTypeName: 'Bureau',
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
  vi.unstubAllGlobals();
});

describe('Aujourd’hui sans réseau', () => {
  it('la journée gardée s’affiche, avec l’heure de sa mise à jour', async () => {
    await saveToday(USER, 'planning', list([visitAssignment]));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<AgentToday />);

    expect(await screen.findByRole('heading', { name: /Visite des lieux · Villa/ })).toBeInTheDocument();
    expect(
      await screen.findByText(/Hors connexion : journée gardée sur ce téléphone, mise à jour à \d\d:\d\d\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('journée lue : gardée avec les fiches du jour, jamais la position d’une visite', async () => {
    stubGateway({
      [LIST]: { status: 200, body: list([visitAssignment, sessionAssignment]) },
      'GET /api/v1/cleaning/agent/me': { status: 200, body: agentBody() },
      [`GET /api/v1/cleaning/agent/visits/${VISIT_ID}`]: {
        status: 200,
        body: visitBody({ status: 'in_progress' }),
      },
      [`GET /api/v1/cleaning/agent/sessions/${SESSION_ID}`]: { status: 200, body: sessionViewBody() },
    });
    render(<AgentToday />);
    await screen.findByRole('heading', { name: /Visite des lieux · Villa/ });

    await waitFor(async () => expect(await readToday(USER, `session:${SESSION_ID}`)).not.toBeNull());
    const planning = await readToday<{ data: unknown[] }>(USER, 'planning');
    expect(planning?.data.data).toHaveLength(2);
    const visit = await readToday<{ status: string; place: { location: unknown } }>(
      USER,
      `visit:${VISIT_ID}`,
    );
    expect(visit?.data.status).toBe('in_progress');
    expect(visit?.data.place.location).toBeNull();
  });
});
