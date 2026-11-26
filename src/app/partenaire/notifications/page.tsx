import type { Metadata } from 'next';
import { partnerNavigation } from '@/config/partner-navigation';
import { NotificationCenter } from '@/features/notification';

export const metadata: Metadata = { title: partnerNavigation.notifications.label };

/** Notifications du partenaire : messages de KSP ; « Voir le dossier » quand le lien mène à une fiche (B2). */
export default function PartnerNotificationsPage() {
  return <NotificationCenter space="partner" />;
}
