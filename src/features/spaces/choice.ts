import type { AccessGrants } from '@/lib/api';

/**
 * Choix de l'espace d'après les droits portés par le jeton (le backend reste seul juge : ce choix ne
 * fait qu'ouvrir le bon écran).
 *
 * - Agent du Nettoyage : permission `cleaning.session.perform` dans `perms` (les `roles` d'une session web
 *   ne contiennent que `customer`).
 * - Partenaire du Recouvrement : rôle `recovery_bailiff` ou `recovery_lawyer`, ou permission partenaire.
 *   La gateway contrôle aujourd'hui ces routes sur `roles` (prérequis back B1) ; la permission
 *   `recovery.assignment.perform` est l'exemple donné par B1 (**à valider** quand le back l'aura choisie).
 */

export type Space = 'agent' | 'partner';

export const AGENT_PERMISSION = 'cleaning.session.perform';
export const PARTNER_ROLES: ReadonlyArray<string> = ['recovery_bailiff', 'recovery_lawyer'];
export const PARTNER_PERMISSIONS: ReadonlyArray<string> = ['recovery.assignment.perform'];

/** Espaces ouverts par les droits du jeton, dans l'ordre d'affichage. */
export function spacesOf(grants: AccessGrants): Space[] {
  const permissions = grants.permissions ?? [];
  const spaces: Space[] = [];
  if (permissions.includes(AGENT_PERMISSION)) spaces.push('agent');
  if (
    grants.roles.some((role) => PARTNER_ROLES.includes(role)) ||
    permissions.some((permission) => PARTNER_PERMISSIONS.includes(permission))
  ) {
    spaces.push('partner');
  }
  return spaces;
}

export function hasSpace(grants: AccessGrants, space: Space): boolean {
  return spacesOf(grants).includes(space);
}

export type SpaceChoice =
  /** Un seul espace : on l'ouvre directement. */
  | { kind: 'open'; space: Space }
  /** Agent et partenaire : deux grandes cartes. */
  | { kind: 'both' }
  /** Aucun espace : on demande au Nettoyage si le compte a candidaté (`GET /cleaning/agent/me`). */
  | { kind: 'check-application' };

export function chooseSpace(grants: AccessGrants): SpaceChoice {
  const spaces = spacesOf(grants);
  if (spaces.length > 1) return { kind: 'both' };
  const [space] = spaces;
  return space ? { kind: 'open', space } : { kind: 'check-application' };
}
