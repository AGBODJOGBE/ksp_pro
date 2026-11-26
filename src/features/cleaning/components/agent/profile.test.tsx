import { render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { AGENT_PERMS, errorBody, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { ACTIVITY, agentBody, ZONES } from '@/features/cleaning/cleaning.test-utils';
import { AgentProfileScreen } from './agent-profile';

const ME = 'GET /api/v1/cleaning/agent/me';
const ACTIVITY_ROUTE = 'GET /api/v1/cleaning/agent/me/activity';
const ZONES_ROUTE = 'GET /api/v1/cleaning/catalog/zones';

beforeEach(async () => {
  await session.clear();
  session.set(
    sessionBody({ profileIncomplete: false, perms: AGENT_PERMS }) as Parameters<typeof session.set>[0],
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('profil et activité', () => {
  it('profil en lecture seule : statut, zones nommées, compétences validées ou non', async () => {
    stubGateway({
      [ME]: { status: 200, body: agentBody('active', 'employee') },
      [ACTIVITY_ROUTE]: { status: 200, body: ACTIVITY },
      [ZONES_ROUTE]: { status: 200, body: ZONES },
    });
    render(<AgentProfileScreen />);

    expect(await screen.findByRole('heading', { name: 'Koffi Adjovi' })).toBeInTheDocument();
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByText(/Votre profil est tenu par KSP/)).toBeInTheDocument();
    expect(screen.getByText('Salarié KSP')).toBeInTheDocument();
    expect(await screen.findByText('Cotonou, Abomey-Calavi')).toBeInTheDocument();
    expect(screen.getByText('+229 01 97 00 00 45')).toBeInTheDocument();
    expect(screen.getByText(/Jardinage/)).toHaveTextContent('En attente de validation');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('activité : heures et séances par semaine et par mois, sans aucun montant', async () => {
    stubGateway({
      [ME]: { status: 200, body: agentBody() },
      [ACTIVITY_ROUTE]: { status: 200, body: ACTIVITY },
      [ZONES_ROUTE]: { status: 200, body: ZONES },
    });
    render(<AgentProfileScreen />);

    const weeks = await screen.findByRole('table', { name: 'Par semaine' });
    expect(within(weeks).getByRole('rowheader', { name: /Semaine du 23 novembre 2026/ })).toBeInTheDocument();
    expect(within(weeks).getByText('12,5 h')).toBeInTheDocument();
    const months = screen.getByRole('table', { name: 'Par mois' });
    expect(within(months).getByText(/novembre 2026/)).toBeInTheDocument();
    expect(screen.getByText('4,6 / 5')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/F\s?CFA|XOF/);
  });

  it('activité illisible : message et « Réessayer », le profil reste affiché', async () => {
    stubGateway({
      [ME]: { status: 200, body: agentBody() },
      [ACTIVITY_ROUTE]: {
        status: 503,
        body: errorBody('CLEANING_UNAVAILABLE', 'Service momentanément indisponible.'),
      },
      [ZONES_ROUTE]: { status: 200, body: ZONES },
    });
    render(<AgentProfileScreen />);

    expect(await screen.findByText(/Service momentanément indisponible\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Koffi Adjovi' })).toBeInTheDocument();
  });
});
