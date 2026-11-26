import { partnerFileHref } from '@/config/partner-navigation';

/**
 * Lien d'une notification vers un écran de l'Espace pro. Seule adresse reconnue aujourd'hui : la fiche d'un
 * dossier confié au partenaire, `/partenaire/dossiers/<assignmentId>` (proposée au back, prérequis B2),
 * sur ce site ou sur l'adresse de production. Toute autre adresse (portail, autre site) est ignorée : la
 * notification s'affiche sans bouton, et l'Espace pro n'ouvre jamais un lien vers un autre site.
 *
 * Renvoie l'adresse interne de la fiche (`/partenaire/dossier?id=`), sans passer par la redirection.
 */
const PARTNER_FILE = /^\/partenaire\/dossiers\/([0-9A-Za-z-]{1,64})\/?$/;
const PRO_ORIGINS = ['https://pro.ksp.bj'];

export function internalLink(link: string | null, siteOrigin?: string): string | null {
  if (!link) return null;
  let url: URL;
  try {
    url = new URL(link, 'https://pro.ksp.bj');
  } catch {
    return null;
  }
  const relative = link.startsWith('/') && !link.startsWith('//');
  const known = relative || PRO_ORIGINS.includes(url.origin) || (!!siteOrigin && url.origin === siteOrigin);
  if (!known) return null;
  const match = PARTNER_FILE.exec(url.pathname);
  return match ? partnerFileHref(match[1]!) : null;
}
