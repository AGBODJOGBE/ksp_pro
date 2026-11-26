import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { stubIndexedDb } from '@/lib/offline/fake-indexeddb.test-utils';
import { PartnerAccount } from './components/partner-account';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const PREFERENCES = 'GET /api/v1/notification/preferences';
const LOGOUT = 'POST /api/v1/identity/logout';

beforeEach(async () => {
  stubIndexedDb();
  replace.mockReset();
  await session.clear();
  session.set(sessionBody({ profileIncomplete: false }) as Parameters<typeof session.set>[0]);
});

afterEach(() => vi.unstubAllGlobals());

describe('« Compte » du partenaire', () => {
  it('profil de la session, préférences, accès, déconnexion', async () => {
    const { calls } = stubGateway({
      [PREFERENCES]: { status: 200, body: { whatsapp: true, email: false, updatedAt: null } },
      [LOGOUT]: { status: 200, body: { revokedSessions: 1 } },
    });
    render(<PartnerAccount />);

    expect(screen.getByText('Koffi Adjovi')).toBeInTheDocument();
    expect(screen.getByText('+229 01 97 00 00 45')).toBeInTheDocument();
    expect(screen.getByText('Aucune adresse e-mail vérifiée.')).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'WhatsApp' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Actualiser mes accès' })).toBeInTheDocument();
    // Le profil vient de la session : aucune lecture de `GET /identity/me`.
    expect(calls.some((call) => call.path === '/api/v1/identity/me')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/connexion'));
    expect(session.get()).toBeNull();
  });

  it('déconnexion refusée par une panne : la session reste', async () => {
    stubGateway({
      [PREFERENCES]: { status: 200, body: { whatsapp: true, email: true, updatedAt: null } },
      [LOGOUT]: { status: 503, body: errorBody('IDENTITY_UNAVAILABLE', 'Service indisponible.') },
    });
    render(<PartnerAccount />);
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(await screen.findByText('Service indisponible.')).toBeInTheDocument();
    expect(session.get()).not.toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});
