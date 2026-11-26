import type { Metadata } from 'next';
import { navigation } from '@/config/navigation';
import { PendingSends } from '@/features/cleaning';

export const metadata: Metadata = { title: navigation.agentOutbox.label };

/** « Envois en attente » : actions de terrain gardées sur le téléphone, pas encore reçues par KSP. */
export default function AgentOutboxPage() {
  return <PendingSends />;
}
