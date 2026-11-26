import type { Metadata } from 'next';
import { navigation } from '@/config/navigation';
import { NotificationCenter } from '@/features/notification';

export const metadata: Metadata = { title: navigation.agentNotifications.label };

/** Notifications de l'agent : messages de KSP, sans lien (les détails sont dans l'application). */
export default function AgentNotificationsPage() {
  return <NotificationCenter />;
}
