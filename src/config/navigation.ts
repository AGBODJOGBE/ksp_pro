export type NavItem = { label: string; href: string };

/**
 * Adresses de l'Espace pro. Chaque espace a sa propre adresse ; `/` choisit l'espace selon les droits du
 * compte (features/spaces).
 */
export const navigation = {
  home: { label: 'Choisir mon espace', href: '/' } satisfies NavItem,
  /** Connexion par téléphone ; `?retour=` ramène à la page demandée (chemin interne uniquement). */
  login: { label: 'Se connecter', href: '/connexion' } satisfies NavItem,
  agent: { label: 'Espace agent', href: '/agent' } satisfies NavItem,
  /** Espace agent : navigation du bas (téléphone), en onglets sur ordinateur. */
  agentToday: { label: 'Aujourd’hui', href: '/agent' } satisfies NavItem,
  agentAssignments: { label: 'Affectations', href: '/agent/affectations' } satisfies NavItem,
  agentAvailability: { label: 'Disponibilités', href: '/agent/disponibilites' } satisfies NavItem,
  agentProfile: { label: 'Profil', href: '/agent/profil' } satisfies NavItem,
  agentNotifications: { label: 'Notifications', href: '/agent/notifications' } satisfies NavItem,
  /** Fiches de terrain : identifiant dans la recherche (`?id=`), une seule coque par écran (service worker). */
  agentVisit: { label: 'Visite', href: '/agent/visite' } satisfies NavItem,
  agentSession: { label: 'Séance', href: '/agent/seance' } satisfies NavItem,
  partner: { label: 'Espace partenaire', href: '/partenaire' } satisfies NavItem,
  application: { label: 'Candidature', href: '/candidature' } satisfies NavItem,
  offline: { label: 'Hors connexion', href: '/hors-ligne' } satisfies NavItem,
} as const;

/** Nom de l'espace affiché dans l'en-tête, d'après l'adresse ; « Espace pro » ailleurs. */
export function spaceLabel(pathname: string): string {
  const spaces = [navigation.agent, navigation.partner, navigation.application];
  const space = spaces.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return space?.label ?? 'Espace pro';
}
