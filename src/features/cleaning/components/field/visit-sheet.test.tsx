import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { AGENT_PERMS, errorBody, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { closeOfflineDatabase } from '@/lib/offline/db';
import { stubIndexedDb } from '@/lib/offline/fake-indexeddb.test-utils';
import { listEntries } from '@/lib/offline/outbox';
import { ARRIVAL, VISIT_ID, visitBody } from '@/features/cleaning/cleaning.test-utils';
import { VisitSheet } from './visit-sheet';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(`id=${VISIT_ID}`) }));

const GET = `GET /api/v1/cleaning/agent/visits/${VISIT_ID}`;
const V = `/api/v1/cleaning/visits/${VISIT_ID}`;
const USER = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11';
const minutes = (count: number) => new Date(Date.now() + count * 60_000).toISOString();

function geolocation(outcome: 'ok' | 'denied' | 'none') {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value:
      outcome === 'none'
        ? undefined
        : {
            getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) =>
              outcome === 'ok'
                ? ok({
                    coords: { latitude: 6.4484, longitude: 2.3558, accuracy: 11.6 },
                  } as GeolocationPosition)
                : fail({ code: 1 } as GeolocationPositionError),
          },
  });
}

beforeEach(async () => {
  stubIndexedDb();
  await session.clear();
  session.set(
    sessionBody({ profileIncomplete: false, perms: AGENT_PERMS }) as Parameters<typeof session.set>[0],
  );
});

afterEach(async () => {
  geolocation('none');
  await closeOfflineDatabase();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const steps = () => within(screen.getByRole('list', { name: 'Étapes' }));

describe('fiche visite', () => {
  it('avant l’arrivée : adresse cachée (commune et type de lieu), « Je suis arrivé » en bas', async () => {
    stubGateway({ [GET]: { status: 200, body: visitBody({ scheduledAt: minutes(30) }) } });
    render(<VisitSheet />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Visite des lieux' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Villa à Abomey-Calavi. L’adresse exacte et le repère s’affichent quand vous marquez votre arrivée.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Itinéraire/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Je suis arrivé' })).toBeEnabled();
    expect(screen.getByText('Marquez d’abord votre arrivée.')).toBeInTheDocument();
    // Client absent : jamais avant l'heure prévue.
    expect(screen.getByRole('button', { name: 'Client absent' })).toBeDisabled();
    expect(screen.getByText(/Possible à partir de/)).toBeInTheDocument();
  });

  it('arrivée avec la position du téléphone ; le lieu et l’itinéraire apparaissent', async () => {
    geolocation('ok');
    const arrived = visitBody({ status: 'in_progress', arrival: ARRIVAL, scheduledAt: minutes(-5) });
    const { calls } = stubGateway({
      [GET]: { status: 200, body: visitBody({ scheduledAt: minutes(-5) }) },
      [`POST ${V}/arrive`]: { status: 200, body: arrived },
    });
    render(<VisitSheet />);
    fireEvent.click(await screen.findByRole('button', { name: 'Je suis arrivé' }));

    expect(await screen.findByRole('link', { name: /Itinéraire/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=6.4485,2.3557',
    );
    expect(screen.getByText('Repère : Portail bleu après la pharmacie')).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toMatchObject({ latitude: 6.4484, longitude: 2.3558, accuracyMeters: 12 });
    expect(post?.body).toHaveProperty('occurredAt');
    expect(post?.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(steps().getByText(/Arrivé à .*, à 40 m du lieu/)).toBeInTheDocument();
  });

  it('position refusée : l’arrivée part sans position, l’agent est prévenu', async () => {
    geolocation('denied');
    const { calls } = stubGateway({
      [GET]: { status: 200, body: visitBody({ scheduledAt: minutes(-5) }) },
      [`POST ${V}/arrive`]: {
        status: 200,
        body: visitBody({
          status: 'in_progress',
          arrival: { ...ARRIVAL, distanceMeters: null },
          scheduledAt: minutes(-5),
        }),
      },
    });
    render(<VisitSheet />);
    fireEvent.click(await screen.findByRole('button', { name: 'Je suis arrivé' }));

    expect(
      await screen.findByText('Position refusée : arrivée enregistrée sans position.'),
    ).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(Object.keys(post?.body as object)).toEqual(['occurredAt']);
  });

  it('constat : prérempli, champ obligatoire signalé, puis envoyé sans montant', async () => {
    const { calls } = stubGateway({
      [GET]: {
        status: 200,
        body: visitBody({ status: 'in_progress', arrival: ARRIVAL, scheduledAt: minutes(-5) }),
      },
      [`PUT ${V}/observations`]: {
        status: 200,
        body: visitBody({
          status: 'in_progress',
          arrival: ARRIVAL,
          scheduledAt: minutes(-5),
          observedValues: { superficie: 150, etat: 'sale', animaux: false },
          note: 'Fuite sous l’évier',
        }),
      },
    });
    render(<VisitSheet />);

    const area = await screen.findByRole('textbox', { name: /Superficie/ });
    expect(area).toHaveValue('120');
    expect(screen.queryByLabelText('Paramètre retiré')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Très sale')).not.toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Enregistrer le constat' });
    await waitFor(() => expect(save).toBeEnabled());

    fireEvent.click(save);
    expect(await screen.findByText('Renseignez cette valeur.')).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(0);

    fireEvent.change(area, { target: { value: '150' } });
    fireEvent.click(screen.getByLabelText('Sale'));
    fireEvent.change(screen.getByRole('textbox', { name: /Note pour le superviseur/ }), {
      target: { value: 'Fuite sous l’évier' },
    });
    fireEvent.click(save);

    expect(await screen.findByText('Constat enregistré.')).toBeInTheDocument();
    const put = calls.find((call) => call.method === 'PUT');
    expect(put?.body).toMatchObject({
      values: { superficie: 150, etat: 'sale', animaux: false },
      note: 'Fuite sous l’évier',
    });
    expect(steps().getByText('150 m²')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Visite terminée' })).toBeInTheDocument();
  });

  it('constat trop tôt (422) : l’heure de la visite est expliquée', async () => {
    stubGateway({
      [GET]: {
        status: 200,
        body: visitBody({ status: 'in_progress', arrival: ARRIVAL, scheduledAt: minutes(-1) }),
      },
      [`PUT ${V}/observations`]: {
        status: 422,
        body: errorBody('CLEANING_VISIT_TOO_EARLY', 'L’heure de la visite n’est pas encore arrivée.', {
          scheduledAt: '2026-11-26T09:00:00.000Z',
          timeZone: 'Africa/Porto-Novo',
        }),
      },
    });
    render(<VisitSheet />);
    await screen.findByRole('textbox', { name: /Superficie/ });
    fireEvent.click(screen.getByLabelText('Propre'));
    const save = screen.getByRole('button', { name: 'Enregistrer le constat' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    expect(await screen.findByText(/Trop tôt : la visite commence à 10:00/)).toBeInTheDocument();
    expect(await listEntries(USER)).toEqual([]);
  });

  it('fin de la visite : confirmation, puis « Visite terminée »', async () => {
    const observed = {
      status: 'in_progress',
      arrival: ARRIVAL,
      scheduledAt: minutes(-30),
      observedValues: { superficie: 150, etat: 'sale' },
    };
    const { calls } = stubGateway({
      [GET]: { status: 200, body: visitBody(observed) },
      [`POST ${V}/complete`]: {
        status: 200,
        body: visitBody({ ...observed, status: 'completed', completedAt: minutes(0) }),
      },
    });
    render(<VisitSheet />);
    const finish = await screen.findByRole('button', { name: 'Visite terminée' });
    await waitFor(() => expect(finish).toBeEnabled());
    fireEvent.click(finish);
    fireEvent.click(screen.getByRole('button', { name: 'Oui, terminer' }));

    expect(await screen.findByText(/Visite terminée à/)).toBeInTheDocument();
    expect(calls.find((call) => call.path === `${V}/complete`)?.body).toHaveProperty('occurredAt');
    expect(screen.queryByRole('button', { name: 'Visite terminée' })).not.toBeInTheDocument();
  });

  it('hors connexion : l’arrivée s’affiche faite, en attente d’envoi', async () => {
    stubGateway({ [GET]: { status: 200, body: visitBody({ scheduledAt: minutes(-5) }) } });
    render(<VisitSheet />);
    await screen.findByRole('button', { name: 'Je suis arrivé' });
    geolocation('none');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Je suis arrivé' }));

    expect(
      await screen.findByText('Enregistré sur le téléphone : envoi dès le retour du réseau.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(steps().getAllByText('En attente d’envoi').length).toBeGreaterThan(0));
    expect(screen.getByText(/1 action attend le réseau pour partir/)).toBeInTheDocument();
    expect(await listEntries(USER)).toEqual([
      expect.objectContaining({ type: 'visit.arrive', status: 'pending' }),
    ]);
  });
});
