/**
 * Compte propriétaire des données gardées sur l'appareil (clé `ksp.compte`, posée à chaque ouverture de
 * session par `./account-data`). Hors connexion, la session ne peut pas être reprise (le jeton d'accès vit
 * en mémoire, son renouvellement passe par la gateway) : ce compte désigne alors les données de terrain à
 * relire (tâches du jour, actions en attente). Affichage seulement : la gateway reste seule juge.
 *
 * Module sans dépendance, lu par la garde des espaces connectés.
 */

export const OWNER_KEY = 'ksp.compte';

/** Compte qui a ouvert la dernière session sur l'appareil, ou `null` (jamais connecté, déconnecté). */
export function deviceAccountId(): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}
