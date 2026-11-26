import { createSessionStore, type Session } from './session';

const NOW = Date.parse('2026-10-21T10:00:00Z');

function sessionOf(accessToken: string, accessTokenExpiresAt = '2026-10-21T10:15:00Z'): Session {
  return {
    status: 'authenticated',
    accessToken,
    accessTokenExpiresAt,
    sessionId: 's1',
    user: {
      id: 'u1',
      status: 'active',
      firstName: null,
      lastName: null,
      phone: '+2290197000045',
      email: null,
      emailVerified: false,
      preferredLanguage: 'fr',
      createdAt: '2026-10-21T09:00:00Z',
    },
    profileIncomplete: true,
    activeContext: { type: 'individual', organizationId: null, organizationName: null },
  };
}

describe('session du navigateur', () => {
  it('garde le jeton d’accès jusqu’à 30 s avant son expiration', () => {
    let clock = NOW;
    const store = createSessionStore({ refresh: async () => null, now: () => clock });

    store.set(sessionOf('jeton'));
    clock = NOW + 14 * 60_000 + 29_000;
    expect(store.getAccessToken()).toBe('jeton');
    clock = NOW + 14 * 60_000 + 31_000;
    expect(store.getAccessToken()).toBeNull();
    expect(store.get()?.accessToken).toBe('jeton');
  });

  it('garde le jeton si l’horloge du téléphone le voit déjà expiré (la gateway tranchera)', () => {
    const store = createSessionStore({ refresh: async () => null, now: () => NOW + 3_600_000 });
    store.set(sessionOf('jeton'));
    expect(store.getAccessToken()).toBe('jeton');
  });

  it('ne lance qu’un renouvellement quand plusieurs requêtes le demandent', async () => {
    const refresh = vi.fn(async () => sessionOf('nouveau'));
    const store = createSessionStore({ refresh, now: () => NOW });

    const results = await Promise.all([store.refresh(), store.refresh(), store.refresh()]);

    expect(results).toEqual([true, true, true]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(store.getAccessToken()).toBe('nouveau');
  });

  it('vide la session si le renouvellement échoue', async () => {
    const store = createSessionStore({
      refresh: async () => {
        throw new Error('réseau');
      },
      now: () => NOW,
    });
    store.set(sessionOf('ancien'));

    await expect(store.refresh()).resolves.toBe(false);
    expect(store.getAccessToken()).toBeNull();
  });

  it('reprend la session : mémoire, puis gateway, en distinguant « pas de session » et « panne »', async () => {
    const memory = createSessionStore({ refresh: vi.fn(), now: () => NOW });
    memory.set(sessionOf('a'));
    await expect(memory.restore()).resolves.toMatchObject({ status: 'authenticated' });

    const renewed = createSessionStore({ refresh: async () => sessionOf('b'), now: () => NOW });
    await expect(renewed.restore()).resolves.toMatchObject({
      status: 'authenticated',
      session: { accessToken: 'b' },
    });

    const anonymous = createSessionStore({ refresh: async () => null, now: () => NOW });
    await expect(anonymous.restore()).resolves.toEqual({ status: 'anonymous' });

    const failure = new Error('réseau');
    const down = createSessionStore({
      refresh: async () => {
        throw failure;
      },
      now: () => NOW,
    });
    await expect(down.restore()).resolves.toEqual({ status: 'unavailable', error: failure });
  });

  it('met à jour le profil sans toucher au jeton', () => {
    const store = createSessionStore({ refresh: async () => null, now: () => NOW });
    store.set(sessionOf('jeton'));
    const user = { ...sessionOf('x').user, firstName: 'Koffi', lastName: 'Adjovi' };

    store.updateProfile({ user, profileIncomplete: false });

    expect(store.get()).toMatchObject({ accessToken: 'jeton', profileIncomplete: false, user });
  });

  it('« Actualiser mes accès » remplace le jeton, et garde la session si la gateway ne répond pas', async () => {
    const refresh = vi
      .fn<() => Promise<Session | null>>()
      .mockResolvedValueOnce(sessionOf('nouveau'))
      .mockRejectedValueOnce(new Error('réseau'))
      .mockResolvedValueOnce(null);
    const store = createSessionStore({ refresh, now: () => NOW });
    store.set(sessionOf('ancien'));

    await expect(store.renew()).resolves.toMatchObject({ status: 'authenticated' });
    expect(store.getAccessToken()).toBe('nouveau');

    await expect(store.renew()).resolves.toMatchObject({ status: 'unavailable' });
    expect(store.getAccessToken()).toBe('nouveau');

    await expect(store.renew()).resolves.toEqual({ status: 'anonymous' });
    expect(store.get()).toBeNull();
  });

  it('prévient les abonnés des changements de session', () => {
    const store = createSessionStore({ refresh: async () => null, now: () => NOW });
    const seen: Array<string | null> = [];
    const unsubscribe = store.subscribe((current) => seen.push(current?.accessToken ?? null));

    store.set(sessionOf('a'));
    store.clear();
    unsubscribe();
    store.set(sessionOf('b'));

    expect(seen).toEqual(['a', null]);
  });
});

describe('données du compte gardées sur l’appareil', () => {
  const store = () => createSessionStore({ refresh: async () => null, now: () => NOW });
  const ofUser = (id: string): Session => {
    const opened = sessionOf('jeton');
    return { ...opened, user: { ...opened.user, id } };
  };

  beforeEach(() => sessionStorage.clear());

  it('la déconnexion efface l’invitation et les brouillons de l’onglet', async () => {
    const current = store();
    current.set(ofUser('u1'));
    await vi.dynamicImportSettled();
    sessionStorage.setItem('ksp.pro.invitation', '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e20');
    sessionStorage.setItem('ksp:pro:brouillon', '{"version":1}');
    sessionStorage.setItem('autre.site', 'gardé');

    await current.clear();

    expect(current.get()).toBeNull();
    expect(sessionStorage.getItem('ksp.pro.invitation')).toBeNull();
    expect(sessionStorage.getItem('ksp:pro:brouillon')).toBeNull();
    expect(sessionStorage.getItem('autre.site')).toBe('gardé');
  });

  it('un autre compte connecté dans le même onglet ne retrouve pas les brouillons du précédent', async () => {
    store().set(ofUser('u1'));
    await vi.dynamicImportSettled();
    sessionStorage.setItem('ksp.pro.invitation', 'i1');

    store().set(ofUser('u2'));
    await vi.dynamicImportSettled();

    expect(sessionStorage.getItem('ksp.pro.invitation')).toBeNull();
  });

  it('une invitation ouverte sans compte est gardée par le compte qui se connecte, puis par ses renouvellements', async () => {
    sessionStorage.setItem('ksp.pro.invitation', 'i1');
    const current = store();

    current.set(ofUser('u1'));
    current.set(ofUser('u1'));
    await vi.dynamicImportSettled();

    expect(sessionStorage.getItem('ksp.pro.invitation')).toBe('i1');
  });
});
