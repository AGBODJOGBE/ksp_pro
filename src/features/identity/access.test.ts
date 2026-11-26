import { session } from '@/lib/api';
import { errorBody, NO_SESSION, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { refreshAccess, signOut } from './access';

const REFRESH = 'POST /api/v1/identity/token/refresh';
const LOGOUT = 'POST /api/v1/identity/logout';
const opened = () =>
  session.set(sessionBody({ profileIncomplete: false }) as Parameters<typeof session.set>[0]);

beforeEach(async () => {
  await session.clear();
  sessionStorage.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe('accès et déconnexion', () => {
  it('« Actualiser mes accès » : nouveau jeton, ou session gardée si la gateway ne répond pas', async () => {
    opened();
    stubGateway({
      [REFRESH]: [
        { status: 200, body: sessionBody({ profileIncomplete: false, perms: ['cleaning.session.perform'] }) },
        { status: 503, body: errorBody('IDENTITY_UNAVAILABLE', 'Service indisponible.') },
        NO_SESSION,
      ],
    });

    expect(await refreshAccess()).toEqual({ status: 'refreshed' });
    expect(await refreshAccess()).toEqual({ status: 'unavailable', message: 'Service indisponible.' });
    expect(session.get()).not.toBeNull();
    expect(await refreshAccess()).toEqual({ status: 'signed-out' });
    expect(session.get()).toBeNull();
  });

  it('déconnexion : ferme la session côté gateway et efface les données du compte', async () => {
    opened();
    sessionStorage.setItem('ksp.pro.invitation', '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e20');
    const { calls } = stubGateway({ [LOGOUT]: { status: 200, body: { revokedSessions: 1 } } });

    expect(await signOut()).toEqual({ ok: true });
    expect(calls.map((call) => call.path)).toEqual(['/api/v1/identity/logout']);
    expect(session.get()).toBeNull();
    expect(sessionStorage.getItem('ksp.pro.invitation')).toBeNull();
  });

  it('session déjà fermée côté gateway : déconnexion locale quand même', async () => {
    opened();
    stubGateway({
      [LOGOUT]: { status: 401, body: errorBody('GATEWAY_TOKEN_INVALID', 'Session expirée.') },
      [REFRESH]: NO_SESSION,
    });

    expect(await signOut()).toEqual({ ok: true });
    expect(session.get()).toBeNull();
  });
});
