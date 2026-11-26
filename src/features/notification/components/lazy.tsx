'use client';

import dynamic from 'next/dynamic';
import { SkeletonCards } from '@/components/ui/skeleton';

/*
 * Écrans des notifications chargés à la demande : importer la fonctionnalité ne fait pas télécharger ses
 * écrans ni ses textes.
 */

/** Sans état de chargement : la pastille apparaît dès qu'elle est prête, sans décaler la page. */
export const NotificationBell = dynamic(() =>
  import('./notification-bell').then((module_) => module_.NotificationBell),
);

export const NotificationCenter = dynamic(
  () => import('./notification-center').then((module_) => module_.NotificationCenter),
  { loading: () => <SkeletonCards label="Chargement…" rows={2} /> },
);

/** Pastille des non lues d'une entrée de navigation : rien au rendu serveur, chargée après l'affichage. */
export const UnreadBadge = dynamic(() => import('./unread-badge').then((module_) => module_.UnreadBadge), {
  ssr: false,
});

/** Préférences de notification (compte du partenaire). */
export const NotificationPreferences = dynamic(
  () => import('./notification-preferences').then((module_) => module_.NotificationPreferences),
  { loading: () => <SkeletonCards label="Chargement…" rows={1} media={false} /> },
);
