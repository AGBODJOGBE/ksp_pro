import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, NO_SESSION, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { AccountMenu } from './account-menu';
import { RequireSession } from './require-session';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/agent',
}));

const REFRESH = 'POST /api/v1/identity/token/refresh';
const LOGOUT = 'POST /api/v1/identity/logout';

function renderSpace() {
  return render(
    <>
      <AccountMenu />
      <RequireSession>
        <p>Contenu réservé</p>
      </RequireSession>
    </>,
  );
}

beforeEach(async () => {
  replace.mockReset();
  await session.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/agent?onglet=semaine');
});

afterEach(() => vi.unstubAllGlobals());

describe('garde des espaces', () => {
  it('renouvelle la session en silence puis affiche l’espace', async () => {
    const { calls } = stubGateway({
      [REFRESH]: { status: 200, body: sessionBody({ profileIncomplete: false }) },
    });
    renderSpace();

    expect(screen.getByRole('status')).toHaveTextContent('Chargement de votre espace…');
    expect(await screen.findByText('Contenu réservé')).toBeInTheDocument();
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/identity/token/refresh',
      body: undefined,
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it('envoie vers la connexion sans session, avec retour à la page demandée', async () => {
    stubGateway({ [REFRESH]: NO_SESSION });
    renderSpace();

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/connexion?retour=%2Fagent%3Fonglet%3Dsemaine'),
    );
    expect(screen.queryByText('Contenu réservé')).toBeNull();
  });

  it('distingue une panne de la gateway et propose de réessayer', async () => {
    stubGateway({
      [REFRESH]: [
        {
          status: 503,
          body: errorBody('IDENTITY_UNAVAILABLE', 'Le service est momentanément indisponible.'),
        },
        { status: 200, body: sessionBody({ profileIncomplete: false }) },
      ],
    });
    renderSpace();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de vérifier votre connexion. Le service est momentanément indisponible.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Contenu réservé')).toBeInTheDocument();
  });

  it('demande le profil avant d’ouvrir l’espace', async () => {
    stubGateway({ [REFRESH]: { status: 200, body: sessionBody({ profileIncomplete: true }) } });
    renderSpace();

    expect(await screen.findByRole('heading', { name: 'Complétez votre profil' })).toBeInTheDocument();
    expect(screen.queryByText('Contenu réservé')).toBeNull();
  });
});

// Le menu est un panneau `popover` fermé : ses boutons sont cachés tant qu'il n'est pas ouvert.
const inMenu = { hidden: true } as const;

describe('menu du compte et déconnexion', () => {
  it('montre le nom et le numéro, puis déconnecte et efface les données du compte', async () => {
    const { calls } = stubGateway({
      [REFRESH]: { status: 200, body: sessionBody({ profileIncomplete: false }) },
      [LOGOUT]: { status: 200, body: { revokedSessions: 1 } },
    });
    renderSpace();
    await screen.findByText('Contenu réservé');
    sessionStorage.setItem('ksp.pro.invitation', '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e20');

    expect(screen.getByRole('button', { name: 'Mon compte : Koffi' })).toBeInTheDocument();
    expect(screen.getByText('Koffi Adjovi')).toBeInTheDocument();
    expect(screen.getByText('+229 01 97 00 00 45')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter', ...inMenu }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/connexion'));
    expect(session.get()).toBeNull();
    expect(sessionStorage.getItem('ksp.pro.invitation')).toBeNull();
    const logout = calls.find((call) => call.path === '/api/v1/identity/logout');
    expect(logout?.headers.Authorization).toMatch(/^Bearer /);
  });

  it('garde la session si la gateway ne répond pas', async () => {
    stubGateway({
      [REFRESH]: { status: 200, body: sessionBody({ profileIncomplete: false }) },
      [LOGOUT]: { status: 503, body: errorBody('IDENTITY_UNAVAILABLE', 'Service indisponible.') },
    });
    renderSpace();
    await screen.findByText('Contenu réservé');
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter', ...inMenu }));

    expect(await screen.findByText('Service indisponible.')).toBeInTheDocument();
    expect(session.get()).not.toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('« Actualiser mes accès » force un renouvellement du jeton', async () => {
    const { calls } = stubGateway({
      [REFRESH]: { status: 200, body: sessionBody({ profileIncomplete: false }) },
    });
    renderSpace();
    await screen.findByText('Contenu réservé');

    fireEvent.click(screen.getByRole('button', { name: 'Actualiser mes accès', ...inMenu }));

    expect(await screen.findByText('Vos accès sont à jour.')).toBeInTheDocument();
    expect(calls.filter((call) => call.path === '/api/v1/identity/token/refresh')).toHaveLength(2);
  });
});
