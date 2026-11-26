import type { Metadata } from 'next';
import { navigation } from '@/config/navigation';
import { RequireSession } from '@/features/identity';
import { PartnerHome } from '@/features/recovery';
import { SpaceGate } from '@/features/spaces';

export const metadata: Metadata = { title: navigation.partner.label };

/** Espace partenaire du Recouvrement (huissiers, avocats) : accueil provisoire. */
export default function PartnerPage() {
  return (
    <RequireSession>
      <SpaceGate space="partner">
        <PartnerHome />
      </SpaceGate>
    </RequireSession>
  );
}
