import type { Metadata } from 'next';
import { navigation } from '@/config/navigation';
import { AgentAvailability } from '@/features/cleaning';

export const metadata: Metadata = { title: navigation.agentAvailability.label };

/** « Mes disponibilités » : semaine type, disponibilités exceptionnelles, indisponibilités. */
export default function AgentAvailabilityPage() {
  return <AgentAvailability />;
}
