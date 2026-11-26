/**
 * Données d'un compte gardées sur l'appareil :
 *
 * - dans l'onglet (`sessionStorage`), toutes les clés qui commencent par `ksp.` ou `ksp:` : invitation d'un
 *   agent en attente de candidature, brouillons ;
 * - la base hors ligne de l'Espace pro (IndexedDB `ksp-pro` : tâches du jour, actions en attente), créée par
 *   les parcours de terrain. Elle est effacée dès maintenant, même si elle n'existe pas encore.
 *
 * Elles appartiennent au compte connecté : effacées à la déconnexion, et dès qu'un autre compte se
 * connecte dans le même onglet. Une donnée gardée sans compte (invitation ouverte avant la connexion) est
 * gardée par le premier compte qui se connecte : c'est le parcours « lien d'invitation, puis connexion ».
 *
 * Module sans dépendance : la session (chargée sur toutes les pages) l'importe à la demande.
 */

const PREFIXES = ['ksp.', 'ksp:'];

/** Compte propriétaire des données de l'onglet. */
const OWNER_KEY = 'ksp.compte';

/** Base hors ligne de l'Espace pro (F-022). */
export const OFFLINE_DATABASE = 'ksp-pro';

function tabStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function clearTab(): void {
  const storage = tabStorage();
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Stockage bloqué : il n'y a rien à effacer.
  }
}

/**
 * Supprime la base hors ligne. Une suppression bloquée (base encore ouverte dans un autre onglet) se
 * termine quand cet onglet la ferme : on n'attend pas, la session est déjà fermée.
 */
function clearOfflineDatabase(): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve();
      const request = indexedDB.deleteDatabase(OFFLINE_DATABASE);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Efface toutes les données du compte sur l'appareil (déconnexion, changement de compte). */
export function clearAccountData(): Promise<void> {
  clearTab();
  return clearOfflineDatabase();
}

/** Attribue les données de l'onglet au compte connecté ; celles d'un autre compte sont effacées. */
export function claimAccountData(userId: string): void {
  const storage = tabStorage();
  if (!storage) return;
  try {
    const owner = storage.getItem(OWNER_KEY);
    if (owner !== null && owner !== userId) void clearAccountData();
    storage.setItem(OWNER_KEY, userId);
  } catch {
    // Stockage bloqué : les données ne sont pas gardées non plus.
  }
}
