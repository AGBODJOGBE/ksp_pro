import type { Metadata } from 'next';
import { partnerNavigation } from '@/config/partner-navigation';
import { PartnerAccount } from '@/features/recovery';

export const metadata: Metadata = { title: partnerNavigation.account.label };

/** « Compte » du partenaire : profil, préférences de notification, accès et déconnexion. */
export default function PartnerAccountPage() {
  return <PartnerAccount />;
}
