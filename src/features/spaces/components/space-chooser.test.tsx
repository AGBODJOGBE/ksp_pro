import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { AGENT_PERMS, errorBody, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { SpaceChooser } from './space-chooser';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/',
}));

const REFRESH = 'POST /api/v1/identity/token/refresh';
const AGENT_ME = 'GET /api/v1/cleaning/agent/me';

const agent = (status: string) => ({
  id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e30',
  userId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
  status,
  firstName: 'Koffi',
  lastName: 'Adjovi',
  phone: '+2290197000045',
  photoUrl: null,
  employmentKind: 'independent',
  residenceCommuneKey: 'cotonou',
  zoneKeys: ['cotonou'],
  skills: [],
  maxHoursPerDay: 8,
  maxHoursPerWeek: 40,
  emergencyContact: { name: 'Afi Adjovi', phone: '+2290197000046' },
  mobileMoneyNumber: null,
  hasIdDocument: true,
  stats: {
    sessionsCompleted: 0,
    visitsCompleted: 0,
    hoursThisWeek: 0,
    hoursThisMonth: 0,
    ratingAverage: null,
    ratingsCount: 0,
    openClaims: 0,
  },
  createdAt: '2026-11-20T09:00:00Z',
  updatedAt: '2026-11-21T09:00:00Z',
});

const NOT_CANDIDATE = {
  status: 404,
  body: errorBody('CLEANING_AGENT_NOT_FOUND', 'Aucun profil d’agent pour ce compte.'),
};

function open(body: ReturnType<typeof sessionBody>) {
  session.set(body as Parameters<typeof session.set>[0]);
  return render(<SpaceChooser />);
}

beforeEach(async () => {
  replace.mockReset();
  await session.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe('choix de l’espace', () => {
  it('agent : ouvre directement l’espace agent, sans appel au Nettoyage', async () => {
    const { calls } = stubGateway({});
    open(sessionBody({ profileIncomplete: false, perms: AGENT_PERMS }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/agent'));
    expect(screen.getByRole('status')).toHaveTextContent('Ouverture de votre espace…');
    expect(calls).toHaveLength(0);
  });

  it('partenaire : ouvre directement l’espace partenaire', async () => {
    stubGateway({});
    open(sessionBody({ profileIncomplete: false, roles: ['customer', 'recovery_bailiff'] }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/partenaire'));
  });

  it('les deux : deux grandes cartes, aucune redirection', async () => {
    stubGateway({});
    open(sessionBody({ profileIncomplete: false, roles: ['recovery_lawyer'], perms: AGENT_PERMS }));

    expect(screen.getByRole('heading', { level: 1, name: 'Bonjour Koffi' })).toBeInTheDocument();
    expect(screen.getByText('Choisissez votre espace.')).toBeInTheDocument();
    const cards = within(screen.getByRole('list')).getAllByRole('link');
    expect(cards.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Espace agent', '/agent'],
      ['Espace partenaire', '/partenaire'],
    ]);
    expect(replace).not.toHaveBeenCalled();
  });

  it('candidat : montre l’état de la candidature', async () => {
    const { calls } = stubGateway({ [AGENT_ME]: { status: 200, body: agent('under_review') } });
    open(sessionBody({ profileIncomplete: false }));

    expect(await screen.findByRole('link', { name: 'Candidature en cours d’examen' })).toHaveAttribute(
      'href',
      '/candidature',
    );
    expect(screen.getByText('En examen')).toBeInTheDocument();
    expect(calls[0]?.headers.Authorization).toMatch(/^Bearer /);
    expect(replace).not.toHaveBeenCalled();
  });

  it('aucun : propose de devenir agent KSP, et l’espace client sur ksp.bj', async () => {
    stubGateway({ [AGENT_ME]: NOT_CANDIDATE });
    open(sessionBody({ profileIncomplete: false }));

    expect(await screen.findByRole('link', { name: 'Devenir agent KSP' })).toHaveAttribute(
      'href',
      '/candidature',
    );
    expect(
      screen.getByText('Aucun espace professionnel n’est encore ouvert sur ce compte.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mon espace client sur ksp\.bj/ })).toHaveAttribute(
      'href',
      'http://localhost:3010',
    );
  });

  it('panne du Nettoyage : message et « Réessayer »', async () => {
    stubGateway({
      [AGENT_ME]: [
        { status: 503, body: errorBody('CLEANING_UNAVAILABLE', 'Service momentanément indisponible.') },
        NOT_CANDIDATE,
      ],
    });
    open(sessionBody({ profileIncomplete: false }));

    expect(
      await screen.findByText('Votre candidature n’a pas pu être lue. Service momentanément indisponible.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('link', { name: 'Devenir agent KSP' })).toBeInTheDocument();
  });

  it('candidature acceptée : « Actualiser mes accès » renouvelle le jeton et ouvre l’espace agent', async () => {
    const { calls } = stubGateway({
      [AGENT_ME]: { status: 200, body: agent('active') },
      [REFRESH]: { status: 200, body: sessionBody({ profileIncomplete: false, perms: AGENT_PERMS }) },
    });
    open(sessionBody({ profileIncomplete: false }));

    expect(await screen.findByRole('link', { name: 'Candidature acceptée' })).toBeInTheDocument();
    // L'action principale de l'écran devient « Actualiser mes accès » (bouton vert).
    const refresh = screen.getByRole('button', { name: 'Actualiser mes accès' });
    await waitFor(() => expect(refresh).toHaveClass('bg-action'));
    fireEvent.click(refresh);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/agent'));
    expect(calls.some((call) => call.path === '/api/v1/identity/token/refresh')).toBe(true);
  });
});
