import type { NavItem } from './navigation';

/**
 * Adresses de l'espace partenaire du Recouvrement. À part de `navigation.ts`, que lit l'en-tête de toutes
 * les pages : les écrans de l'agent (fiches de terrain, à moins de 1 Ko du budget) n'en sont pas alourdis.
 */
export const partnerNavigation = {
  /** Navigation du bas (téléphone), en onglets sur ordinateur. */
  assignments: { label: 'Dossiers', href: '/partenaire' } satisfies NavItem,
  notifications: { label: 'Notifications', href: '/partenaire/notifications' } satisfies NavItem,
  account: { label: 'Compte', href: '/partenaire/compte' } satisfies NavItem,
  /**
   * Fiche d'un dossier confié : identifiant dans la recherche (`?id=`), une seule coque. Le lien des
   * notifications (`/partenaire/dossiers/<assignmentId>`, prérequis back B2) y est redirigé (next.config.ts).
   */
  file: { label: 'Dossier', href: '/partenaire/dossier' } satisfies NavItem,
} as const;

/** Fiche d'un dossier confié au partenaire. */
export function partnerFileHref(assignmentId: string): string {
  return `${partnerNavigation.file.href}?id=${encodeURIComponent(assignmentId)}`;
}
