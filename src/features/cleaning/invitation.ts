/**
 * Invitation d'un agent (R-AG-02) : le SMS d'invitation ouvre `/invitations/<invitationId>` (adresse
 * fixée par le back, valable 7 jours). Aucune route ne permet de lire une invitation : l'identifiant est
 * gardé dans l'onglet jusqu'à la candidature, qui l'envoie (`invitationId`). La gateway reste juge
 * (`CLEANING_VALIDATION_FAILED`, champ `invitationId` : introuvable, déjà utilisée ou expirée).
 *
 * Clé `ksp.…` : effacée à la déconnexion et quand un autre compte se connecte ; gardée par le premier
 * compte qui se connecte après l'ouverture du lien (`lib/api/account-data`).
 */

export const INVITATION_KEY = 'ksp.pro.invitation';

/** Identifiant au format du contrat (UUID). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isInvitationId(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** Écrans qui affichent l'invitation gardée (`useSyncExternalStore`). */
const listeners = new Set<() => void>();

export function subscribeInvitation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const notify = () => listeners.forEach((listener) => listener());

function tabStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Garde l'invitation pour la candidature ; `false` si l'identifiant est invalide ou le stockage bloqué. */
export function keepInvitation(id: string): boolean {
  if (!isInvitationId(id)) return false;
  try {
    tabStorage()?.setItem(INVITATION_KEY, id.toLowerCase());
    return tabStorage()?.getItem(INVITATION_KEY) === id.toLowerCase();
  } catch {
    return false;
  } finally {
    notify();
  }
}

/** Invitation gardée dans l'onglet, ou `null`. */
export function readInvitation(): string | null {
  try {
    const id = tabStorage()?.getItem(INVITATION_KEY) ?? null;
    return isInvitationId(id) ? id : null;
  } catch {
    return null;
  }
}

/** Invitation utilisée (candidature envoyée) ou refusée par la gateway. */
export function forgetInvitation(): void {
  try {
    tabStorage()?.removeItem(INVITATION_KEY);
  } catch {
    // Stockage bloqué : rien à oublier.
  }
  notify();
}
