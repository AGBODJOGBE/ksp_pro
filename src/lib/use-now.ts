'use client';

import { useEffect, useState } from 'react';

/**
 * Heure courante, relue toutes les `intervalMs` millisecondes : comptes à rebours (réponse à une
 * affectation), « prochaine intervention ». `null` au rendu serveur et au premier rendu, pour que
 * l'hydratation ne dépende pas de l'horloge.
 */
export function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
