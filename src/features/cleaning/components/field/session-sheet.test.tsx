import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { session } from '@/lib/api';
import { AGENT_PERMS, errorBody, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { closeOfflineDatabase } from '@/lib/offline/db';
import { stubIndexedDb } from '@/lib/offline/fake-indexeddb.test-utils';
import {
  ARRIVAL,
  photoBody,
  SESSION_ID,
  sessionViewBody,
  uploadRoutes,
} from '@/features/cleaning/cleaning.test-utils';
import { SessionSheet } from './session-sheet';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(`id=${SESSION_ID}`) }));

const GET = `GET /api/v1/cleaning/agent/sessions/${SESSION_ID}`;
const S = `/api/v1/cleaning/sessions/${SESSION_ID}`;
const minutes = (count: number) => new Date(Date.now() + count * 60_000).toISOString();

const RUNNING = {
  status: 'in_progress',
  arrival: ARRIVAL,
  startedAt: minutes(-20),
  scheduledStart: minutes(-25),
  photos: [photoBody('f1', 'before')],
};

beforeEach(async () => {
  stubIndexedDb();
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
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

describe('fiche séance', () => {
  it('chef d’équipe : équipe, lieu caché, arrivée ; trop tôt, l’avance permise est expliquée', async () => {
    const { calls } = stubGateway({
      [GET]: { status: 200, body: sessionViewBody({ scheduledStart: minutes(90) }) },
      [`POST ${S}/arrive`]: {
        status: 422,
        body: errorBody('CLEANING_SESSION_TOO_EARLY', 'Il est trop tôt pour marquer l’arrivée.', {
          scheduledStart: '2026-11-26T09:00:00.000Z',
          maximumMinutes: 30,
          timeZone: 'Africa/Porto-Novo',
        }),
      },
    });
    render(<SessionSheet />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Séance de nettoyage' })).toBeInTheDocument();
    expect(screen.getByText(/Vous êtes chef d’équipe/)).toBeInTheDocument();
    expect(screen.getByText('Rachidi Sanni')).toBeInTheDocument();
    expect(
      screen.getByText(/L’adresse exacte et le repère s’affichent pendant la séance/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Je suis arrivé' }));
    expect(
      await screen.findByText(
        'Trop tôt pour marquer l’arrivée : c’est possible 30 min avant le début (10:00) au plus.',
      ),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ occurredAt: expect.any(String) });
    expect(screen.getByRole('button', { name: 'Je suis arrivé' })).toBeInTheDocument();
  });

  it('membre de l’équipe : les gestes du chef sont masqués et expliqués', async () => {
    stubGateway({
      [GET]: { status: 200, body: sessionViewBody({ isLead: false, scheduledStart: minutes(-5) }) },
    });
    render(<SessionSheet />);

    expect(await screen.findByText(/Koffi Adjovi est chef d’équipe/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Je suis arrivé' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Démarrer la séance' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Client absent ou accès impossible' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Le chef d’équipe marque l’arrivée.')).toBeInTheDocument();
    expect(screen.getByText('Le chef d’équipe démarre la séance.')).toBeInTheDocument();
    expect(screen.getByText('Le chef d’équipe déclare le client absent.')).toBeInTheDocument();
    // Un membre prend les photos « avant ».
    expect(screen.getByLabelText('Prendre une photo « avant »')).toBeInTheDocument();
  });

  it('démarrage refusé (paiement en retard) : « Contactez votre superviseur »', async () => {
    stubGateway({
      [GET]: {
        status: 200,
        body: sessionViewBody({
          arrival: ARRIVAL,
          scheduledStart: minutes(-5),
          photos: [photoBody('f1', 'before')],
        }),
      },
      [`POST ${S}/start`]: {
        status: 422,
        body: errorBody(
          'CLEANING_SESSION_OVERDUE_PAYMENT',
          'Une séance précédente est en retard de paiement.',
        ),
      },
    });
    render(<SessionSheet />);
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer la séance' }));

    expect(
      await screen.findByText('La séance ne peut pas démarrer pour le moment. Contactez votre superviseur.'),
    ).toBeInTheDocument();
  });

  it('garantie de solde non tenue : même consigne', async () => {
    stubGateway({
      [GET]: {
        status: 200,
        body: sessionViewBody({
          arrival: ARRIVAL,
          scheduledStart: minutes(-5),
          photos: [photoBody('f1', 'before')],
        }),
      },
      [`POST ${S}/start`]: {
        status: 422,
        body: errorBody('CLEANING_BALANCE_GUARANTEE_NOT_MET', 'Solde insuffisant.'),
      },
    });
    render(<SessionSheet />);
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer la séance' }));
    expect(await screen.findByText(/Contactez votre superviseur/)).toBeInTheDocument();
  });

  it('liste de contrôle : chaque case part avec son type et son heure réelle', async () => {
    const { calls } = stubGateway({
      [GET]: { status: 200, body: sessionViewBody(RUNNING) },
      [`PATCH ${S}/checklist`]: {
        status: 200,
        body: sessionViewBody({
          ...RUNNING,
          checklist: [
            {
              code: 'arrival',
              label: 'Matériel déballé',
              cleaningTypeCode: null,
              checked: false,
              checkedAt: null,
            },
            {
              code: 'sol_balayage',
              label: 'Sols balayés',
              cleaningTypeCode: 'sol',
              checked: true,
              checkedAt: minutes(0),
            },
          ],
        }),
      },
    });
    render(<SessionSheet />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Sols balayés/ }));

    await waitFor(() => expect(screen.getByText('1 / 2 points faits')).toBeInTheDocument());
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.body).toEqual({
      items: [{ code: 'sol_balayage', checked: true, cleaningTypeCode: 'sol' }],
      occurredAt: expect.any(String),
    });
    expect(screen.getByRole('checkbox', { name: /Sols balayés/ })).toBeChecked();
  });

  it('client absent avant la fin de l’attente : la durée réglementaire est expliquée', async () => {
    const { calls } = stubGateway({
      [GET]: { status: 200, body: sessionViewBody({ arrival: ARRIVAL, scheduledStart: minutes(-10) }) },
      ...uploadRoutes(['f1']),
      [`POST ${S}/missed`]: {
        status: 422,
        body: errorBody('CLEANING_WAIT_TIME_NOT_ELAPSED', 'Attente insuffisante.', { minimumMinutes: 30 }),
      },
    });
    render(<SessionSheet />);
    const open = await screen.findByRole('button', { name: 'Client absent ou accès impossible' });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);

    fireEvent.click(await screen.findByRole('button', { name: 'Déclarer la séance manquée' }));
    expect(await screen.findByText('Choisissez le motif.')).toBeInTheDocument();
    expect(screen.getByText('Prenez une photo du lieu.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Client absent'));
    fireEvent.change(document.getElementById('photo-absence-seance') as HTMLInputElement, {
      target: { files: [new File(['jpeg'], 'lieu.jpg', { type: 'image/jpeg' })] },
    });
    await screen.findByRole('list', { name: 'Photo du lieu (obligatoire)' });
    fireEvent.change(screen.getByLabelText('Début de l’attente'), { target: { value: '00:00' } });
    fireEvent.change(screen.getByLabelText('Heure de l’appel au client'), { target: { value: '00:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer la séance manquée' }));

    expect(
      await screen.findByText(
        'Attendez encore : le client peut être déclaré absent après 30 min d’attente, comptées à partir de l’heure prévue.',
      ),
    ).toBeInTheDocument();
    const missed = calls.find((call) => call.path === `${S}/missed`);
    expect(missed?.body).toEqual({
      cause: 'customer_absent',
      waitStartedAt: expect.any(String),
      calledAt: expect.any(String),
      occurredAt: expect.any(String),
      photoFileId: 'f1',
    });
  });

  it('incident : nature et description, la séance passe interrompue', async () => {
    const { calls } = stubGateway({
      [GET]: { status: 200, body: sessionViewBody(RUNNING) },
      [`POST ${S}/incident`]: {
        status: 200,
        body: sessionViewBody({
          ...RUNNING,
          status: 'interrupted',
          incidents: [
            {
              id: 'i1',
              category: 'equipment',
              note: 'Aspirateur en panne',
              photos: [],
              reportedAt: minutes(0),
              decision: 'pending',
              decidedAt: null,
            },
          ],
        }),
      },
    });
    render(<SessionSheet />);
    fireEvent.click(await screen.findByRole('button', { name: 'Signaler un incident' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Signaler l’incident' }));
    expect(await screen.findByText('Choisissez la nature de l’incident.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Matériel'));
    fireEvent.change(screen.getByRole('textbox', { name: /Ce qui se passe/ }), {
      target: { value: 'Aspirateur en panne' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Signaler l’incident' }));

    expect(
      await screen.findByText(/Séance interrompue : votre superviseur décide de la suite/),
    ).toBeInTheDocument();
    expect(screen.getByText('En attente du superviseur')).toBeInTheDocument();
    expect(calls.find((call) => call.path === `${S}/incident`)?.body).toEqual({
      category: 'equipment',
      note: 'Aspirateur en panne',
      occurredAt: expect.any(String),
    });
    expect(screen.getByRole('button', { name: 'Signaler un incident' })).toBeDisabled();
  });

  it('clôture : réservée au chef, liste complète et photo « après » ; signature facultative', async () => {
    const done = {
      ...RUNNING,
      photos: [photoBody('f1', 'before'), photoBody('f2', 'after')],
      checklist: [
        {
          code: 'arrival',
          label: 'Matériel déballé',
          cleaningTypeCode: null,
          checked: true,
          checkedAt: minutes(-5),
        },
      ],
    };
    const { calls } = stubGateway({
      [GET]: { status: 200, body: sessionViewBody(done) },
      [`POST ${S}/complete`]: {
        status: 200,
        body: sessionViewBody({ ...done, status: 'completed', completedAt: minutes(0) }),
      },
    });
    render(<SessionSheet />);
    fireEvent.click(await screen.findByRole('button', { name: 'Clôturer la séance' }));
    expect(
      await screen.findByText('Signature impossible sur ce téléphone : clôturez sans signature.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clôturer la séance' }));

    expect(await screen.findByText(/Séance réalisée, clôturée à/)).toBeInTheDocument();
    expect(calls.find((call) => call.path === `${S}/complete`)?.body).toEqual({
      occurredAt: expect.any(String),
    });
  });
});
