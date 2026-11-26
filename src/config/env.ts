/**
 * Variables d'environnement validées une seule fois. Une valeur invalide arrête le démarrage avec un
 * message clair, plutôt qu'une erreur obscure en production.
 *
 * Les variables NEXT_PUBLIC_* sont lues une par une : Next.js ne remplace que les accès explicites.
 *
 * Sans zod, contrairement au portail : ce module est chargé par toutes les pages (client de la gateway)
 * et zod, même `zod/mini`, pèserait près de 19 Ko de plus au premier chargement de chaque écran
 * (budget de 200 Ko de l'Espace pro). Les schémas des réponses chargent zod à la demande.
 */

/** Adresse http(s) complète, sans barre finale. */
function url(name: string, value: string): string {
  let parsed: URL | null = null;
  try {
    parsed = new URL(value);
  } catch {
    parsed = null;
  }
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(
      `${name} : adresse complète attendue, par exemple https://pro.ksp.bj (reçu « ${value} »).`,
    );
  }
  return value.replace(/\/+$/, '');
}

export interface PublicEnv {
  siteUrl: string;
  apiUrl: string;
  /** Portail du groupe : l'espace des clients (« Mon espace KSP »). */
  portailUrl: string;
}

export const publicEnv: PublicEnv = {
  siteUrl: url('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3050'),
  apiUrl: url('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005'),
  portailUrl: url('NEXT_PUBLIC_PORTAIL_URL', process.env.NEXT_PUBLIC_PORTAIL_URL ?? 'http://localhost:3010'),
};
