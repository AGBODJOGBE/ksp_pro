/** Textes du centre de notifications, chargés seulement par ses écrans. */

export const notificationTexts = {
  title: 'Notifications',
  lead: 'Les messages de KSP sur vos affectations et votre compte.',
  loading: 'Chargement des notifications…',
  retry: 'Réessayer',
  loadMore: 'Afficher plus',
  loadingMore: 'Chargement…',
  empty: 'Aucune notification pour le moment.',
  emptyUnread: 'Vous avez tout lu.',
  filtersLabel: 'Afficher',
  filterAll: 'Toutes',
  filterUnread: 'Non lues',
  unreadCount: (count: number) =>
    count === 0 ? 'Aucune non lue' : count === 1 ? '1 non lue' : `${count} non lues`,
  unreadLabel: 'Non lue',
  markRead: 'Marquer comme lue',
  markAllRead: 'Tout marquer comme lu',
  markingAll: 'En cours…',
  allMarked: 'Toutes vos notifications sont marquées comme lues.',
  receivedOn: (date: string) => `Reçue le ${date}`,
  genericError: 'Une erreur est survenue. Réessayez dans quelques instants.',
  bell: {
    label: 'Notifications',
    unread: (count: number) => (count === 1 ? '1 notification non lue' : `${count} notifications non lues`),
    none: 'Aucune notification non lue',
  },
} as const;
