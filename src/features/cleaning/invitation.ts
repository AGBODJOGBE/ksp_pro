import { readStored, removeStored, writeStored } from '@/lib/device-storage';

/**
 * Invitation d'un agent (R-AG-02) : le SMS d'invitation ouvre `/invitations/<invitationId>` (adresse
 * fixée par le back, valable 7 jours). Aucune route ne permet de lire une invitation : l'identifiant est
 * gardé sur l'appareil jusqu'à la candidature, qui l'envoie (`invitationId`). La gateway reste juge
 * (`CLEANING_VALIDATION_FAILED`, champ `invitationId` : introuvable, déjà utilisée ou expirée).
 *
 * Gardée dans `localStorage` 7 jours (la durée de l'invitation) : le lien s'ouvre souvent dans le
 * navigateur, et la candidature peut se faire ensuite dans l'application installée. Clé `ksp.…` :
 * effacée à la déconnexion et quand un autre compte se connecte ; gardée par le premier compte qui se
 * connecte après l'ouverture du lien (`lib/api/account-data`).
 */

export const INVITATION_KEY = 'ksp.pro.invitation';
/** Durée de garde, en jours : celle d'une invitation. */
export const INVITATION_DAYS = 7;

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

/**
 * Garde l'invitation pour la candidature ; `false` si l'identifiant est invalide ou le stockage bloqué.
 * Rouvrir le même lien ne prolonge pas sa durée de garde.
 */
export function keepInvitation(id: string, now: number = Date.now()): boolean {
  if (!isInvitationId(id)) return false;
  const value = id.toLowerCase();
  try {
    if (readInvitation(now) === value) return true;
    return writeStored(INVITATION_KEY, value, INVITATION_DAYS, now) && readInvitation(now) === value;
  } finally {
    notify();
  }
}

/** Invitation gardée et encore valable, ou `null`. */
export function readInvitation(now: number = Date.now()): string | null {
  const id = readStored<unknown>(INVITATION_KEY, now);
  return typeof id === 'string' && isInvitationId(id) ? id : null;
}

/** Invitation utilisée (candidature envoyée) ou refusée par la gateway. */
export function forgetInvitation(): void {
  removeStored(INVITATION_KEY);
  notify();
}
