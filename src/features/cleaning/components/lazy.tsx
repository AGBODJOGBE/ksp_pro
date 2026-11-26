'use client';

import dynamic from 'next/dynamic';
import { SkeletonCards } from '@/components/ui/skeleton';

/*
 * Écrans du Nettoyage chargés à la demande : importer la fonctionnalité (choix de l'espace, cadre de
 * l'espace agent) ne fait pas télécharger ses écrans ni leurs textes. Chaque page ne charge que le sien,
 * pendant que la session se vérifie. Libellé d'attente écrit ici : ce relais est lu par plusieurs pages.
 */

function Loading() {
  return <SkeletonCards label="Chargement…" rows={2} />;
}

export const ApplicationScreen = dynamic(
  () => import('./application/application-screen').then((module_) => module_.ApplicationScreen),
  { loading: Loading },
);

export const InvitationWelcome = dynamic(
  () => import('./invitation-welcome').then((module_) => module_.InvitationWelcome),
  { loading: Loading },
);

export const AgentToday = dynamic(() => import('./agent/agent-today').then((module_) => module_.AgentToday), {
  loading: Loading,
});

export const AgentAssignments = dynamic(
  () => import('./agent/agent-assignments').then((module_) => module_.AgentAssignments),
  { loading: Loading },
);

export const AgentAvailability = dynamic(
  () => import('./agent/agent-availability').then((module_) => module_.AgentAvailability),
  { loading: Loading },
);

export const AgentProfileScreen = dynamic(
  () => import('./agent/agent-profile').then((module_) => module_.AgentProfileScreen),
  { loading: Loading },
);

export const VisitSheet = dynamic(() => import('./field/visit-sheet').then((module_) => module_.VisitSheet), {
  loading: Loading,
});

export const SessionSheet = dynamic(
  () => import('./field/session-sheet').then((module_) => module_.SessionSheet),
  { loading: Loading },
);

export const PendingSends = dynamic(
  () => import('./field/pending-sends').then((module_) => module_.PendingSends),
  { loading: Loading },
);

/**
 * État du terrain et rejeu de la file d'attente (cadre de l'espace agent) : rien au rendu serveur (il dépend
 * du navigateur), chargé après l'affichage, sans état de chargement (rien ne bouge quand tout est envoyé).
 */
export const FieldStatus = dynamic(
  () => import('./field/field-status').then((module_) => module_.FieldStatus),
  { ssr: false },
);
