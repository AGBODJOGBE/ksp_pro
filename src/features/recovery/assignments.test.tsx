import { fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { PartnerAssignments } from './components/assignment-list';
import { readProblem } from './errors';
import { ApiError } from '@/lib/api';
import { ASSIGNMENTS, activeAssignment, assignment, ASSIGNMENT_ID } from './recovery.test-utils';

const LIST = `GET ${ASSIGNMENTS}`;

beforeEach(async () => {
  await session.clear();
  session.set(
    sessionBody({ profileIncomplete: false, roles: ['customer', 'recovery_bailiff'] }) as Parameters<
      typeof session.set
    >[0],
  );
});

afterEach(() => vi.unstubAllGlobals());

const query = (fetchMock: ReturnType<typeof stubGateway>['fetchMock'], index: number) =>
  new URL(String(fetchMock.mock.calls[index]?.[0])).searchParams;

describe('« Mes dossiers »', () => {
  it('onglets par statut, pagination par curseur (« Voir plus »), carte du dossier en cours', async () => {
    const { fetchMock } = stubGateway({
      [LIST]: [
        { status: 200, body: { assignments: [activeAssignment()], nextCursor: 'page-2' } },
        {
          status: 200,
          body: {
            assignments: [assignment('0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e1004', 'REC-2026-00015', 'active')],
            nextCursor: null,
          },
        },
        {
          status: 200,
          body: {
            assignments: [
              assignment('0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e1002', 'REC-2026-00007', 'withdrawn', {
                withdrawnAt: '2026-11-05T11:00:00Z',
                withdrawalReason: 'Dossier confié à un avocat.',
              }),
            ],
            nextCursor: null,
          },
        },
      ],
    });
    render(<PartnerAssignments />);

    const link = await screen.findByRole('link', { name: 'REC-2026-00012' });
    expect(link).toHaveAttribute('href', `/partenaire/dossier?id=${ASSIGNMENT_ID}`);
    expect(query(fetchMock, 0).get('status')).toBe('active');
    expect(query(fetchMock, 0).get('cursor')).toBeNull();
    const card = link.closest('article')!;
    expect(within(card).getByText('En cours')).toBeInTheDocument();
    expect(within(card).getByText('2 actes')).toBeInTheDocument();
    expect(within(card).getByText(/Dernier acte : Signification, le 18 novembre 2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Voir plus' }));
    expect(await screen.findByRole('link', { name: 'REC-2026-00015' })).toBeInTheDocument();
    expect(query(fetchMock, 1).get('cursor')).toBe('page-2');
    expect(screen.queryByRole('button', { name: 'Voir plus' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Retirés' }));
    const withdrawn = await screen.findByRole('heading', { name: 'REC-2026-00007' });
    expect(query(fetchMock, 2).get('status')).toBe('withdrawn');
    // Un dossier retiré ne s'ouvre pas : sa fiche répondrait 404.
    expect(within(withdrawn).queryByRole('link')).not.toBeInTheDocument();
    const withdrawnCard = withdrawn.closest('article')!;
    expect(within(withdrawnCard).getByText(/Motif : Dossier confié à un avocat\./)).toBeInTheDocument();
    expect(
      within(withdrawnCard).getByText('Ce dossier ne vous est plus confié : sa fiche ne s’ouvre plus.'),
    ).toBeInTheDocument();
  });

  it('liste vide de l’onglet', async () => {
    stubGateway({ [LIST]: { status: 200, body: { assignments: [], nextCursor: null } } });
    render(<PartnerAssignments />);
    expect(await screen.findByText('Aucun dossier en cours ne vous est confié.')).toBeInTheDocument();
  });

  it('403 (accès pas encore actif, B1) : écran clair, « Actualiser mes accès », puis « Réessayer »', async () => {
    const { calls } = stubGateway({
      [LIST]: [
        { status: 403, body: errorBody('AUTH_FORBIDDEN', "Vous n'avez pas les droits nécessaires.") },
        { status: 200, body: { assignments: [activeAssignment()], nextCursor: null } },
      ],
    });
    render(<PartnerAssignments />);

    expect(
      await screen.findByRole('heading', { name: 'Votre accès partenaire n’est pas encore actif' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Contactez KSP pour activer votre accès, puis actualisez vos accès.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualiser mes accès' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('link', { name: 'REC-2026-00012' })).toBeInTheDocument();
    expect(calls.filter((call) => call.path === ASSIGNMENTS)).toHaveLength(2);
  });

  it('panne : message, référence et « Réessayer »', async () => {
    stubGateway({
      [LIST]: { status: 503, body: errorBody('RECOVERY_DEPENDENCY_UNAVAILABLE', 'Service indisponible.') },
    });
    render(<PartnerAssignments />);
    expect(await screen.findByText(/Service indisponible\. \(référence : /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});

describe('lecture des refus du recouvrement', () => {
  const error = (status: number, code: string, details: Record<string, unknown> = {}) =>
    new ApiError(status, code, 'Message de la gateway.', details, 'c-1');

  it.each([
    [error(403, 'AUTH_FORBIDDEN'), 'forbidden'],
    [error(404, 'RECOVERY_ASSIGNMENT_NOT_FOUND'), 'gone'],
    [error(400, 'RECOVERY_VALIDATION_FAILED', { field: 'actDate' }), 'field'],
    [error(400, 'RECOVERY_VALIDATION_FAILED'), 'other'],
    [error(422, 'RECOVERY_CASE_SUSPENDED'), 'suspended'],
    [error(422, 'RECOVERY_PAYMENT_AMOUNT_INVALID', { due: { amount: 10, currency: 'XOF' } }), 'amount'],
    [error(409, 'RECOVERY_IDEMPOTENCY_KEY_REUSED'), 'keyReused'],
    [error(422, 'RECOVERY_INVALID_TRANSITION'), 'transition'],
    [error(404, 'GATEWAY_ROUTE_NOT_FOUND'), 'other'],
    [new Error('réseau'), 'other'],
  ])('%s → %s', (caught, kind) => {
    expect(readProblem(caught).kind).toBe(kind);
  });

  it('champ en cause et reste dû', () => {
    expect(readProblem(error(400, 'RECOVERY_VALIDATION_FAILED', { field: 'cost' }))).toEqual({
      kind: 'field',
      field: 'cost',
      message: 'Message de la gateway.',
    });
    expect(
      readProblem(
        error(422, 'RECOVERY_PAYMENT_AMOUNT_INVALID', { due: { amount: 325_000, currency: 'XOF' } }),
      ),
    ).toMatchObject({ kind: 'amount', due: 325_000 });
  });
});
