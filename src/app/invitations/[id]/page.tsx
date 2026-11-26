import type { Metadata } from 'next';
import { InvitationWelcome } from '@/features/cleaning';

export const metadata: Metadata = { title: 'Invitation' };

/**
 * Lien d'invitation d'un agent (`/invitations/<invitationId>`, adresse fixée par le back, envoyée par
 * SMS). Rendu à la demande (l'identifiant n'est connu qu'à la requête), sans garde de session : la
 * connexion se fait ensuite, avec le numéro invité. `no-referrer` (next.config.ts).
 */
export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvitationWelcome id={id} />;
}
