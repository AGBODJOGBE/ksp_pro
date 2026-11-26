import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { AGENT_PERMS, errorBody, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { agentBody, assignmentBody, list } from '@/features/cleaning/cleaning.test-utils';
import { AgentAssignments } from './agent-assignments';
import { AgentToday } from './agent-today';
import { AssignmentCard } from './assignment-card';

const ME = 'GET /api/v1/cleaning/agent/me';
const LIST = 'GET /api/v1/cleaning/agent/me/assignments';
const ACCEPT = 'POST /api/v1/cleaning/agent/assignments/a-1/accept';
const DECLINE = 'POST /api/v1/cleaning/agent/assignments/a-1/decline';

const NOW = Date.parse('2026-11-26T08:00:00Z');
const pending = assignmentBody({
  assignmentId: 'a-1',
  status: 'pending_confirmation',
  isLead: true,
  start: '2026-11-27T09:00:00Z',
  end: '2026-11-27T12:00:00Z',
  respondBefore: '2026-11-26T10:15:00Z',
});

function card(props: Partial<Parameters<typeof AssignmentCard>[0]> = {}) {
  const onUpdated = vi.fn();
  const onStale = vi.fn();
  render(
    <AssignmentCard
      assignment={pending as Parameters<typeof AssignmentCard>[0]['assignment']}
      canRespond
      now={NOW}
      onUpdated={onUpdated}
      onStale={onStale}
      {...props}
    />,
  );
  return { onUpdated, onStale };
}

beforeEach(async () => {
  await session.clear();
  session.set(
    sessionBody({ profileIncomplete: false, perms: AGENT_PERMS }) as Parameters<typeof session.set>[0],
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('affectation', () => {
  it('montre l’horaire, la nature, le lieu, le chef d’équipe et le compte à rebours', () => {
    stubGateway({});
    card();
    expect(screen.getByRole('heading', { name: 'Séance de nettoyage · Villa' })).toBeInTheDocument();
    expect(screen.getByText('10:00 – 13:00')).toBeInTheDocument();
    expect(screen.getByText('Chef d’équipe')).toBeInTheDocument();
    expect(screen.getByText('Répondez avant 11:15')).toBeInTheDocument();
    expect(screen.getByText('· il reste 2 h 15')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir la fiche' })).toHaveAttribute(
      'href',
      '/agent/seance?id=0192f1c4-7a2b-7c3d-8e4f-5a6b7c8db001',
    );
  });

  it('indépendant : accepte avec une clé d’idempotence, la carte suit la réponse', async () => {
    const { calls } = stubGateway({ [ACCEPT]: { status: 200, body: { ...pending, status: 'confirmed' } } });
    const { onUpdated } = card();

    fireEvent.click(screen.getByRole('button', { name: 'Accepter' }));
    expect(await screen.findByText('Affectation acceptée.')).toBeInTheDocument();
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmed' }));
    expect(calls[0]?.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  });

  it('refus : demande une confirmation avant d’envoyer', async () => {
    const { calls } = stubGateway({ [DECLINE]: { status: 200, body: { ...pending, status: 'declined' } } });
    card();

    fireEvent.click(screen.getByRole('button', { name: 'Refuser' }));
    expect(
      screen.getByText('Refuser cette affectation ? KSP la proposera à un autre agent.'),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Garder' }));
    expect(screen.getByRole('button', { name: 'Accepter' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refuser' }));
    fireEvent.click(screen.getByRole('button', { name: 'Oui, refuser' }));
    expect(await screen.findByText('Affectation refusée.')).toBeInTheDocument();
    expect(calls.map((call) => call.path)).toEqual(['/api/v1/cleaning/agent/assignments/a-1/decline']);
  });

  it('délai dépassé côté gateway : message et liste relue', async () => {
    stubGateway({
      [ACCEPT]: {
        status: 422,
        body: errorBody('CLEANING_INVALID_TRANSITION', 'Transition impossible.'),
      },
    });
    const { onStale } = card();

    fireEvent.click(screen.getByRole('button', { name: 'Accepter' }));
    expect(
      await screen.findByText('Cette affectation n’attend plus votre réponse. La liste est mise à jour.'),
    ).toBeInTheDocument();
    expect(onStale).toHaveBeenCalled();
  });

  it('délai dépassé à l’heure de l’appareil : plus de boutons', () => {
    stubGateway({});
    card({ now: Date.parse('2026-11-26T10:16:00Z') });
    expect(screen.getByText('Délai de réponse dépassé.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accepter' })).not.toBeInTheDocument();
  });

  it('salarié : rien à accepter', () => {
    stubGateway({});
    card({ canRespond: false });
    expect(screen.queryByRole('button', { name: 'Accepter' })).not.toBeInTheDocument();
    expect(screen.getByText('En attente de confirmation par KSP.')).toBeInTheDocument();
  });

  it('retirée : pas de lien vers la fiche', () => {
    stubGateway({});
    card({ assignment: { ...pending, status: 'removed', respondBefore: null } as never });
    expect(screen.getByText('Retirée')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ouvrir la fiche' })).not.toBeInTheDocument();
  });
});

describe('mes affectations', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('indépendant : explication, onglets par statut, filtre envoyé à la gateway', async () => {
    const { calls } = stubGateway({
      [ME]: { status: 200, body: agentBody('active', 'independent') },
      [LIST]: { status: 200, body: list([pending]) },
    });
    render(<AgentAssignments />);

    expect(await screen.findByText(/Indépendant partenaire : acceptez ou refusez/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Accepter' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'À confirmer' }));
    await waitFor(() =>
      expect(calls.some((call) => call.path.endsWith('/me/assignments') && call.method === 'GET')).toBe(true),
    );
    const tabs = within(screen.getByRole('tablist', { name: 'Statut des affectations' }));
    expect(tabs.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Toutes',
      'À confirmer',
      'Confirmées',
      'Proposées',
      'Refusées',
      'Expirées',
      'Retirées',
    ]);
  });

  it('salarié : affectations confirmées d’office, sans onglet « À confirmer »', async () => {
    stubGateway({
      [ME]: { status: 200, body: agentBody('active', 'employee') },
      [LIST]: { status: 200, body: list([assignmentBody()]) },
    });
    render(<AgentAssignments />);

    expect(await screen.findByText(/vous n’avez pas à les accepter/)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'À confirmer' })).not.toBeInTheDocument();
    expect(await screen.findByText('Confirmée')).toBeInTheDocument();
  });

  it('période invalide : signalée, la liste garde la dernière période valide', async () => {
    stubGateway({
      [ME]: { status: 200, body: agentBody() },
      [LIST]: { status: 200, body: list([]) },
    });
    render(<AgentAssignments />);
    expect(await screen.findByText('Aucune affectation sur cette période.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Au (inclus)'), { target: { value: '2020-01-01' } });
    expect(screen.getByText('La fin de la période doit suivre son début.')).toBeInTheDocument();
  });

  it('lecture impossible : message et « Réessayer »', async () => {
    stubGateway({
      [ME]: { status: 200, body: agentBody() },
      [LIST]: [
        { status: 503, body: errorBody('CLEANING_UNAVAILABLE', 'Service momentanément indisponible.') },
        { status: 200, body: list([assignmentBody()]) },
      ],
    });
    render(<AgentAssignments />);

    expect(await screen.findByText(/Service momentanément indisponible\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Confirmée')).toBeInTheDocument();
  });
});

describe('aujourd’hui', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('la prochaine intervention en tête, puis le reste de la journée et ce qui est passé', async () => {
    const past = assignmentBody({
      assignmentId: 'p',
      start: '2026-11-26T06:00:00Z',
      end: '2026-11-26T07:00:00Z',
      placeTypeName: 'Bureau',
    });
    const next = assignmentBody({
      assignmentId: 'n',
      target: { kind: 'visit', id: 'v-1' },
      start: '2026-11-26T09:00:00Z',
      end: '2026-11-26T10:00:00Z',
      placeTypeName: 'Villa',
    });
    const later = assignmentBody({
      assignmentId: 'l',
      start: '2026-11-26T13:00:00Z',
      end: '2026-11-26T15:00:00Z',
      placeTypeName: 'Appartement',
    });
    const removed = assignmentBody({
      assignmentId: 'r',
      status: 'removed',
      start: '2026-11-26T16:00:00Z',
      end: '2026-11-26T17:00:00Z',
      placeTypeName: 'Entrepôt',
    });
    const { fetchMock } = stubGateway({
      [ME]: { status: 200, body: agentBody() },
      [LIST]: [
        { status: 200, body: list([past, next, later, removed]) },
        { status: 200, body: { ...list([pending]), total: 2 } },
      ],
    });
    render(<AgentToday />);

    const first = await screen.findByRole('region', { name: 'Prochaine intervention' });
    expect(within(first).getByRole('heading', { name: 'Visite des lieux · Villa' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Plus tard aujourd’hui' })).getByText(/Appartement/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Déjà passées' })).getByText(/Bureau/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Annulées ou retirées' })).getByText(/Entrepôt/),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: /2 affectations attendent votre réponse/ }),
    ).toHaveAttribute('href', '/agent/affectations');
    // Journée du Bénin : de minuit à minuit (UTC+1), triée par début.
    const day = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .find((url) => url.pathname.endsWith('/me/assignments') && url.searchParams.has('from'));
    expect(day?.searchParams.get('from')).toBe('2026-11-25T23:00:00.000Z');
    expect(day?.searchParams.get('to')).toBe('2026-11-26T23:00:00.000Z');
    expect(day?.searchParams.get('sort')).toBe('start');
  });

  it('journée vide : un message et le lien vers les affectations', async () => {
    stubGateway({
      [ME]: { status: 200, body: agentBody() },
      [LIST]: { status: 200, body: list([]) },
    });
    render(<AgentToday />);

    expect(await screen.findByText('Aucune intervention prévue aujourd’hui.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir mes affectations' })).toHaveAttribute(
      'href',
      '/agent/affectations',
    );
  });
});
