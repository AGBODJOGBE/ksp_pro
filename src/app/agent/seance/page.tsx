import type { Metadata } from 'next';
import { Suspense } from 'react';
import { navigation } from '@/config/navigation';
import { SessionSheet } from '@/features/cleaning';

export const metadata: Metadata = { title: navigation.agentSession.label };

/**
 * Fiche d'une séance de nettoyage (`?id=` : une seule coque statique, gardée par le service worker) :
 * arrivée, photos, démarrage, liste de contrôle, clôture, incident ou client absent, même sans réseau.
 */
export default function AgentSessionPage() {
  return (
    <Suspense>
      <SessionSheet />
    </Suspense>
  );
}
