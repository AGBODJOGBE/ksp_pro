'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, isBackendPending } from '@/lib/api';
import { getMyAgentProfile } from '@/features/cleaning/api';
import { agentTexts } from '@/features/cleaning/agent-texts';
import type { AgentProfile } from '@/features/cleaning/schemas';

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  /** Route pas encore servie par le backend : `BackendPending`. */
  | { status: 'pending' }
  | { status: 'error'; message: string; correlationId?: string };

/** Message affichable d'une erreur : celui de la gateway (en français), avec sa référence pour le support. */
export function describeError(error: unknown): { message: string; correlationId?: string } {
  if (error instanceof ApiError) return { message: error.message, correlationId: error.correlationId };
  return { message: agentTexts.genericError };
}

/**
 * Lecture d'une ressource de l'espace agent au montage, relancée par `reload` (« Réessayer »). `load`
 * doit être stable (fonction de module ou `useCallback`). `set` remplace la donnée après une écriture
 * (la gateway renvoie la ressource à jour).
 */
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState(
          isBackendPending(error) ? { status: 'pending' } : { status: 'error', ...describeError(error) },
        );
      },
    );
    return () => controller.abort();
  }, [load, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);
  /** Relit sans repasser par le chargement (après une action : la liste reste affichée). */
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  const set = useCallback((data: T) => setState({ status: 'ready', data }), []);
  return { state, reload, refresh, set };
}

/** Nombre d'affectations touchées, lu dans les détails d'un refus (`details.assignments`). */
export function affectedCount(error: ApiError): number {
  const assignments = error.details.assignments;
  return Array.isArray(assignments) ? assignments.length : 0;
}

const loadProfile = (signal: AbortSignal) => getMyAgentProfile(signal);

/** Profil de l'agent connecté (`GET /cleaning/agent/me`) : statut d'emploi, compétences, zones. */
export function useAgentProfile() {
  return useLoad<AgentProfile | null>(loadProfile);
}

/** Indépendant partenaire (réponse aux affectations) ; inconnu tant que le profil n'est pas lu. */
export function isIndependent(state: LoadState<AgentProfile | null>): boolean {
  return state.status === 'ready' && state.data?.employmentKind === 'independent';
}
