import { fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { AGENT_PERMS, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { closeOfflineDatabase } from '@/lib/offline/db';
import { stubIndexedDb } from '@/lib/offline/fake-indexeddb.test-utils';
import { addEntry, listEntries, type NewOutboxEntry, patchEntry } from '@/lib/offline/outbox';
import { SESSION_ID, sessionViewBody, VISIT_ID } from '@/features/cleaning/cleaning.test-utils';
import { PendingSends } from './pending-sends';

const USER = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11';
const HOUR = 3_600_000;

function entry(overrides: Partial<NewOutboxEntry>): NewOutboxEntry {
  const occurredAt = overrides.occurredAt ?? Date.now() - HOUR;
  return {
    userId: USER,
    group: `session:${SESSION_ID}`,
    type: 'session.arrive',
    body: { occurredAt: new Date(occurredAt).toISOString() },
    key: `cle-${Math.random().toString(36).slice(2, 12)}`,
    occurredAt,
    files: [],
    context: 'Villa · Cotonou · 10:00',
    ...overrides,
  };
}

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

describe('envois en attente', () => {
  it('tout est envoyé : état vide', async () => {
    stubGateway({});
    render(<PendingSends />);
    expect(await screen.findByText('Tout est envoyé.')).toBeInTheDocument();
  });

  it('par intervention, dans l’ordre ; refus expliqué, action bloquée, délai de 72 h', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const refused = await addEntry(entry({ type: 'session.start' }));
    await patchEntry(refused, {
      status: 'error',
      error: {
        status: 422,
        code: 'CLEANING_SESSION_OVERDUE_PAYMENT',
        message: 'Une séance précédente est impayée.',
        correlationId: 'c-42',
      },
    });
    await addEntry(
      entry({
        type: 'session.checklist',
        label: 'Sols balayés',
        body: { items: [{ code: 'sol', checked: true }] },
      }),
    );
    await addEntry(
      entry({ group: `visit:${VISIT_ID}`, type: 'visit.arrive', occurredAt: Date.now() - 61 * HOUR }),
    );
    stubGateway({});
    render(<PendingSends />);

    const sessionGroup = await screen.findByRole('region', { name: 'Séance de nettoyage' });
    expect(within(sessionGroup).getByText('Villa · Cotonou · 10:00')).toBeInTheDocument();
    expect(within(sessionGroup).getByText('Séance démarrée')).toBeInTheDocument();
    expect(
      within(sessionGroup).getByText(
        'La séance ne peut pas démarrer pour le moment. Contactez votre superviseur.',
      ),
    ).toBeInTheDocument();
    expect(within(sessionGroup).getByText('Bloquée par l’action non envoyée ci-dessus.')).toBeInTheDocument();
    expect(within(sessionGroup).getByText('· Sols balayés')).toBeInTheDocument();

    fireEvent.click(within(sessionGroup).getByRole('button', { name: 'Voir l’erreur' }));
    expect(within(sessionGroup).getByText('Code : CLEANING_SESSION_OVERDUE_PAYMENT')).toBeInTheDocument();
    expect(within(sessionGroup).getByText('Référence : c-42')).toBeInTheDocument();
    // Hors connexion : rien ne peut partir.
    expect(within(sessionGroup).getByRole('button', { name: 'Réessayer' })).toBeDisabled();
    expect(screen.getByText('Hors connexion : l’envoi reprendra au retour du réseau.')).toBeInTheDocument();

    const visitGroup = screen.getByRole('region', { name: 'Visite des lieux' });
    expect(
      within(visitGroup).getByText(/À envoyer avant .* : passé 72 h, KSP ne pourra plus l’enregistrer\./),
    ).toBeInTheDocument();
  });

  it('plus de 72 h : pas de « Réessayer », l’agent retire l’action après confirmation', async () => {
    const old = await addEntry(entry({}));
    await patchEntry(old, {
      status: 'error',
      error: {
        status: 400,
        code: 'CLEANING_VALIDATION_FAILED',
        message: 'Valeur refusée.',
        details: { field: 'occurredAt', reason: 'too_old' },
      },
    });
    stubGateway({});
    render(<PendingSends />);

    expect(
      await screen.findByText(/Action de plus de 72 h : KSP ne peut plus l’enregistrer/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Oui, retirer' }));
    expect(await screen.findByText('Tout est envoyé.')).toBeInTheDocument();
    expect(await listEntries(USER)).toEqual([]);
  });

  it('« Envoyer maintenant » rejoue la file', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await addEntry(entry({}));
    const { calls } = stubGateway({
      [`POST /api/v1/cleaning/sessions/${SESSION_ID}/arrive`]: { status: 200, body: sessionViewBody() },
    });
    render(<PendingSends />);
    fireEvent.click(await screen.findByRole('button', { name: 'Envoyer maintenant' }));

    expect(await screen.findByText('Tout est envoyé.')).toBeInTheDocument();
    expect(calls.map((call) => call.path)).toEqual([`/api/v1/cleaning/sessions/${SESSION_ID}/arrive`]);
  });
});
