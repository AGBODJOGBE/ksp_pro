/**
 * Données d'un compte gardées sur l'appareil :
 *
 * - dans l'onglet (`sessionStorage`) et sur l'appareil (`localStorage`), toutes les clés qui commencent par
 *   `ksp.` ou `ksp:` : invitation d'un agent en attente de candidature, brouillon de la candidature
 *   (`lib/device-storage`, 7 jours). Les réglages de confort de l'appareil (`ksp-pro.…`, refus de
 *   l'incitation à installer) ne sont pas des données du compte : ils restent ;
 * - la base hors ligne de l'Espace pro (IndexedDB `ksp-pro` : tâches du jour, actions en attente), créée par
 *   les parcours de terrain. Elle est effacée dès maintenant, même si elle n'existe pas encore.
 *
 * Elles appartiennent au compte connecté : effacées à la déconnexion, et dès qu'un autre compte se
 * connecte sur l'appareil. Une donnée gardée sans compte (invitation ouverte avant la connexion) est
 * gardée par le premier compte qui se connecte : c'est le parcours « lien d'invitation, puis connexion ».
 *
 * Module sans dépendance : la session (chargée sur toutes les pages) l'importe à la demande.
 */

import { OWNER_KEY } from './device-account';

const PREFIXES = ['ksp.', 'ksp:'];

/** Base hors ligne de l'Espace pro (F-022). */
export const OFFLINE_DATABASE = 'ksp-pro';

type Kind = 'sessionStorage' | 'localStorage';
const KINDS: ReadonlyArray<Kind> = ['sessionStorage', 'localStorage'];

function storageOf(kind: Kind): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window[kind];
  } catch {
    return null;
  }
}

function clearStorage(storage: Storage | null): void {
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
  KINDS.forEach((kind) => clearStorage(storageOf(kind)));
  return clearOfflineDatabase();
}

/** Attribue les données gardées au compte connecté ; celles d'un autre compte sont effacées. */
export function claimAccountData(userId: string): void {
  const owners = KINDS.map((kind) => {
    try {
      return storageOf(kind)?.getItem(OWNER_KEY) ?? null;
    } catch {
      return null;
    }
  });
  if (owners.some((owner) => owner !== null && owner !== userId)) void clearAccountData();
  for (const kind of KINDS) {
    try {
      storageOf(kind)?.setItem(OWNER_KEY, userId);
    } catch {
      // Stockage bloqué : les données ne sont pas gardées non plus.
    }
  }
}
