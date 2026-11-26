import type { Metadata } from 'next';
import { navigation } from '@/config/navigation';
import { AgentToday } from '@/features/cleaning';
import { NotificationBell } from '@/features/notification';

export const metadata: Metadata = { title: navigation.agentToday.label };

/** « Aujourd'hui » : les interventions du jour, la prochaine en tête ; accès aux notifications. */
export default function AgentTodayPage() {
  return <AgentToday aside={<NotificationBell href={navigation.agentNotifications.href} />} />;
}
