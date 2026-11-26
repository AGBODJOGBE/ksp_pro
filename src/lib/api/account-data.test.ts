import { claimAccountData, clearAccountData, OFFLINE_DATABASE } from './account-data';

/** IndexedDB simulée : seule la suppression d'une base est utilisée. */
function stubIndexedDb(outcome: 'success' | 'blocked' | 'error' = 'success') {
  const deleted: string[] = [];
  vi.stubGlobal('indexedDB', {
    deleteDatabase(name: string) {
      deleted.push(name);
      const request: Record<string, (() => void) | null> = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      queueMicrotask(() => request[`on${outcome}`]?.());
      return request;
    },
  });
  return deleted;
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

describe('données du compte sur l’appareil', () => {
  it('la déconnexion supprime aussi la base hors ligne de l’Espace pro', async () => {
    const deleted = stubIndexedDb();
    sessionStorage.setItem('ksp.pro.invitation', 'i1');

    await clearAccountData();

    expect(deleted).toEqual([OFFLINE_DATABASE]);
    expect(sessionStorage.getItem('ksp.pro.invitation')).toBeNull();
  });

  it.each(['blocked', 'error'] as const)(
    'une suppression %s ne bloque pas la déconnexion',
    async (outcome) => {
      stubIndexedDb(outcome);
      await expect(clearAccountData()).resolves.toBeUndefined();
    },
  );

  it('sans IndexedDB (navigateur ancien, test), seul l’onglet est vidé', async () => {
    sessionStorage.setItem('ksp.pro.invitation', 'i1');
    await expect(clearAccountData()).resolves.toBeUndefined();
    expect(sessionStorage.getItem('ksp.pro.invitation')).toBeNull();
  });

  it('un autre compte efface les données du précédent, base hors ligne comprise', () => {
    const deleted = stubIndexedDb();
    claimAccountData('u1');
    sessionStorage.setItem('ksp.pro.invitation', 'i1');

    claimAccountData('u2');

    expect(sessionStorage.getItem('ksp.pro.invitation')).toBeNull();
    expect(sessionStorage.getItem('ksp.compte')).toBe('u2');
    expect(deleted).toEqual([OFFLINE_DATABASE]);
  });

  it('le brouillon et l’invitation gardés sur l’appareil suivent les mêmes règles', async () => {
    stubIndexedDb();
    claimAccountData('u1');
    localStorage.setItem('ksp.pro.candidature', '{}');
    localStorage.setItem('ksp-pro.installation.refusee', '1');

    claimAccountData('u2');
    expect(localStorage.getItem('ksp.pro.candidature')).toBeNull();
    expect(localStorage.getItem('ksp.compte')).toBe('u2');

    localStorage.setItem('ksp.pro.invitation', '{}');
    await clearAccountData();
    expect(localStorage.getItem('ksp.pro.invitation')).toBeNull();
    // Réglage de confort de l'appareil, pas une donnée du compte.
    expect(localStorage.getItem('ksp-pro.installation.refusee')).toBe('1');
  });
});
