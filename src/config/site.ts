import { publicEnv } from './env';

/** Identité de l'Espace pro (F-021) et lien vers le portail du groupe. */
export const siteConfig = {
  id: 'pro',
  name: 'KSP Pro',
  /** Nom court affiché dans l'en-tête et sous l'icône de l'application installée. */
  shortName: 'KSP Pro',
  domain: 'pro.ksp.bj',
  description:
    'L’espace des professionnels du Groupe KSP : agents du Nettoyage et partenaires du Recouvrement. Vos missions sur votre téléphone, même avec un réseau faible.',
  url: publicEnv.siteUrl,
  locale: 'fr_BJ',
  /** Couleur de marque (bleu nuit du logo, F-017) : barre d'état de l'application installée. */
  themeColor: '#0F2850',
  portailUrl: publicEnv.portailUrl,
} as const;
