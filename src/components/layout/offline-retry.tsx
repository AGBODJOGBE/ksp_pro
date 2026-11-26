'use client';

import { BottomBar } from '@/components/ui/bottom-bar';
import { Button } from '@/components/ui/button';
import { IconRefresh } from '@/components/ui/icons';

/**
 * « Réessayer » de la page hors connexion : recharge la page demandée (le service worker sert la page
 * hors connexion à son adresse, sans redirection), qui s'affiche dès que le réseau répond.
 */
export function OfflineRetry({ label }: { label: string }) {
  return (
    <BottomBar>
      <Button
        variant="action"
        size="lg"
        className="w-full sm:w-auto"
        onClick={() => window.location.reload()}
      >
        <IconRefresh />
        {label}
      </Button>
    </BottomBar>
  );
}
