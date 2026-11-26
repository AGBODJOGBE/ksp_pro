import type { Metadata } from 'next';
import { navigation } from '@/config/navigation';
import { AgentAssignments } from '@/features/cleaning';

export const metadata: Metadata = { title: navigation.agentAssignments.label };

/** « Mes affectations » : période, onglets par statut, réponse d'un indépendant. */
export default function AgentAssignmentsPage() {
  return <AgentAssignments />;
}
