import type { Metadata } from 'next';
import { navigation } from '@/config/navigation';
import { AgentProfileScreen } from '@/features/cleaning';
import { NotificationBell } from '@/features/notification';

export const metadata: Metadata = { title: navigation.agentProfile.label };

/** « Profil » : profil d'agent en lecture, puis l'activité (heures et séances, sans montants). */
export default function AgentProfilePage() {
  return <AgentProfileScreen aside={<NotificationBell href={navigation.agentNotifications.href} />} />;
}
