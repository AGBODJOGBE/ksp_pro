'use client';

import { useSession } from '@/lib/api';
import { deviceAccountId } from '@/lib/api/device-account';

/**
 * Compte des données de terrain : celui de la session ; hors connexion (session impossible à reprendre),
 * celui qui a ouvert la dernière session sur ce téléphone.
 */
export function useFieldAccount(): string | null {
  const current = useSession();
  return current?.user.id ?? deviceAccountId();
}
