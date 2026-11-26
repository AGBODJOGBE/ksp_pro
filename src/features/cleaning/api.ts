'use client';

import { api, ApiError, parseResponse } from '@/lib/api';
import type { AgentProfile } from './schemas';

/** Appels du navigateur aux routes de l'agent du Nettoyage (`/api/v1/cleaning/agent/*`). */

const PATHS = {
  me: '/api/v1/cleaning/agent/me',
} as const;

/** Code de la gateway : le compte n'a jamais candidaté (`GET /cleaning/agent/me`, 404). */
export const AGENT_NOT_FOUND = 'CLEANING_AGENT_NOT_FOUND';

/**
 * Mon profil d'agent : statut de la candidature, ou `null` si le compte n'a jamais candidaté. Toute autre
 * erreur (réseau, panne, droits) remonte telle quelle.
 */
export async function getMyAgentProfile(signal?: AbortSignal): Promise<AgentProfile | null> {
  try {
    // Schéma (zod) chargé pendant l'appel : hors du premier chargement de l'écran.
    const [{ agentProfileSchema }, body] = await Promise.all([
      import('./schemas'),
      api.get(PATHS.me, { signal }),
    ]);
    return parseResponse(agentProfileSchema, body);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.code === AGENT_NOT_FOUND) return null;
    throw error;
  }
}
