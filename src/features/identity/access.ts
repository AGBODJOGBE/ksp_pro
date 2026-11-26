'use client';

import { ApiError, session } from '@/lib/api';
import { logout } from './api';
import { describeError } from './errors';

export type AccessRefreshResult =
  /** Nouveau jeton : rôles et permissions à jour. */
  | { status: 'refreshed' }
  /** Plus de session valide : il faut se reconnecter. */
  | { status: 'signed-out' }
  /** La gateway n'a pas répondu : la session en cours est gardée. */
  | { status: 'unavailable'; message: string };

/**
 * « Actualiser mes accès » : force `POST /api/v1/identity/token/refresh`. Un rôle donné par KSP (agent
 * validé, partenaire) n'apparaît dans le jeton qu'à son renouvellement (15 minutes au plus sinon).
 */
export async function refreshAccess(): Promise<AccessRefreshResult> {
  const result = await session.renew();
  if (result.status === 'authenticated') return { status: 'refreshed' };
  if (result.status === 'anonymous') return { status: 'signed-out' };
  return { status: 'unavailable', message: describeError(result.error).message };
}

/**
 * Déconnexion : la gateway ferme la session de cet appareil (cookie de renouvellement effacé), puis les
 * données du compte sont effacées de l'appareil (session en mémoire, invitation, base hors ligne).
 * Une session déjà fermée côté gateway (401) est fermée ici aussi ; une panne garde la session et
 * renvoie le message à afficher.
 */
export async function signOut(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await logout();
  } catch (error) {
    if (!(error instanceof ApiError && error.isUnauthenticated)) {
      return { ok: false, message: describeError(error).message };
    }
  }
  await session.clear();
  return { ok: true };
}
