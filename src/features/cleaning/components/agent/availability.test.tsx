import { fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { AGENT_PERMS, errorBody, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { availabilityBody } from '@/features/cleaning/cleaning.test-utils';
import { AgentAvailability } from './agent-availability';

const GET = 'GET /api/v1/cleaning/agent/me/availability';
const PUT = 'PUT /api/v1/cleaning/agent/me/availability';
const DECLARE = 'POST /api/v1/cleaning/agent/me/unavailabilities';
const REMOVE = 'DELETE /api/v1/cleaning/agent/me/unavailabilities/0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dd001';

beforeEach(async () => {
  await session.clear();
  session.set(
    sessionBody({ profileIncomplete: false, perms: AGENT_PERMS }) as Parameters<typeof session.set>[0],
  );
});

afterEach(() => vi.unstubAllGlobals());

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes disponibilités' }));

describe('mes disponibilités', () => {
  it('affiche la semaine type, les indisponibilités et la charge fixée par KSP', async () => {
    stubGateway({ [GET]: { status: 200, body: availabilityBody() } });
    render(<AgentAvailability />);

    expect(await screen.findByRole('checkbox', { name: 'Lundi' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Mardi' })).not.toBeChecked();
    expect(screen.getByText('Congé')).toBeInTheDocument();
    expect(screen.getByText('Du 22 décembre 2026 au 26 décembre 2026')).toBeInTheDocument();
    expect(screen.getByText('8 h par jour et 40 h par semaine au plus, fixées par KSP.')).toBeInTheDocument();
  });

  it('enregistre la semaine type et les disponibilités exceptionnelles (le PUT remplace les deux)', async () => {
    const { calls } = stubGateway({
      [GET]: { status: 200, body: availabilityBody() },
      [PUT]: (body) => {
        const sent = body as { weekly: unknown; extraAvailabilities: Array<{ start: string; end: string }> };
        const extraAvailabilities = sent.extraAvailabilities.map((slot, index) => ({
          id: `x-${index}`,
          ...slot,
        }));
        return { status: 200, body: availabilityBody({ weekly: sent.weekly, extraAvailabilities }) };
      },
    });
    render(<AgentAvailability />);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Mardi' }));
    const extras = screen.getByRole('group', { name: 'Ajouter cette disponibilité' });
    fireEvent.change(within(extras).getByLabelText('Date'), { target: { value: '2026-12-06' } });
    fireEvent.change(within(extras).getByLabelText('De'), { target: { value: '09:00' } });
    fireEvent.change(within(extras).getByLabelText('À'), { target: { value: '13:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter cette disponibilité' }));
    expect(screen.getByText('Modifications non enregistrées.')).toBeInTheDocument();
    save();

    expect(await screen.findByText('Vos disponibilités sont enregistrées.')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
      weekly: [
        { weekday: 'mon', ranges: [{ start: '08:00', end: '17:00' }] },
        { weekday: 'tue', ranges: [{ start: '08:00', end: '17:00' }] },
      ],
      // Heure du Bénin (UTC+1).
      extraAvailabilities: [{ start: '2026-12-06T08:00:00.000Z', end: '2026-12-06T12:00:00.000Z' }],
    });
  });

  it('plage déjà occupée par une affectation (409) : expliqué, la saisie est gardée', async () => {
    stubGateway({
      [GET]: { status: 200, body: availabilityBody() },
      [PUT]: {
        status: 409,
        body: errorBody('CLEANING_AVAILABILITY_IN_USE', 'Cette plage est déjà occupée.', {
          assignments: ['a-1'],
        }),
      },
    });
    render(<AgentAvailability />);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Lundi' }));
    save();
    expect(
      await screen.findByText(
        'Vous retirez une plage déjà occupée par 1 affectation. Pour la libérer, contactez votre superviseur KSP.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Lundi' })).not.toBeChecked();
  });

  it('plage illisible : signalée sous la ligne, rien n’est envoyé', async () => {
    const { calls } = stubGateway({ [GET]: { status: 200, body: availabilityBody() } });
    render(<AgentAvailability />);

    const [start] = await screen.findAllByLabelText('De');
    fireEvent.change(start!, { target: { value: '18:00' } });
    save();
    expect(screen.getByText('L’heure de fin doit suivre l’heure de début.')).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(0);
  });
});

describe('indisponibilités', () => {
  it('déclare une indisponibilité (journées entières, clé d’idempotence)', async () => {
    const { calls } = stubGateway({
      [GET]: { status: 200, body: availabilityBody() },
      [DECLARE]: { status: 200, body: availabilityBody() },
    });
    render(<AgentAvailability />);

    fireEvent.click(await screen.findByRole('button', { name: 'Déclarer une indisponibilité' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’indisponibilité' }));
    expect(screen.getByText('Choisissez un motif.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Maladie' }));
    fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Au (inclus)'), { target: { value: '2026-12-02' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Précision (facultatif)' }), {
      target: { value: 'Repos prescrit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’indisponibilité' }));

    expect(await screen.findByText('Indisponibilité enregistrée.')).toBeInTheDocument();
    const declared = calls.find((call) => call.method === 'POST');
    expect(declared?.body).toEqual({
      start: '2026-11-30T23:00:00.000Z',
      end: '2026-12-02T23:00:00.000Z',
      kind: 'sickness',
      note: 'Repos prescrit',
    });
    expect(declared?.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  });

  it('période qui chevauche des affectations (409) : seul le superviseur peut l’enregistrer', async () => {
    stubGateway({
      [GET]: { status: 200, body: availabilityBody() },
      [DECLARE]: {
        status: 409,
        body: errorBody('CLEANING_UNAVAILABILITY_CONFLICT', 'Chevauchement.', {
          assignments: ['a-1', 'a-2'],
        }),
      },
    });
    render(<AgentAvailability />);

    fireEvent.click(await screen.findByRole('button', { name: 'Déclarer une indisponibilité' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Congé' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’indisponibilité' }));
    expect(
      await screen.findByText(
        'Cette période chevauche 2 affectations déjà prévues. Seul votre superviseur KSP peut l’enregistrer : contactez-le.',
      ),
    ).toBeInTheDocument();
  });

  it('retire une indisponibilité après confirmation', async () => {
    const { calls } = stubGateway({
      [GET]: { status: 200, body: availabilityBody() },
      [REMOVE]: { status: 200, body: availabilityBody({ unavailabilities: [] }) },
    });
    render(<AgentAvailability />);

    fireEvent.click(await screen.findByRole('button', { name: 'Retirer' }));
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Oui, retirer' }));
    expect(await screen.findByText('Indisponibilité retirée.')).toBeInTheDocument();
    expect(screen.getByText('Aucune indisponibilité à venir.')).toBeInTheDocument();
  });
});
