'use client';

import { type Cached, readToday, saveToday } from '@/lib/offline/today';
import { getAgentSession, getAgentVisit } from '@/features/cleaning/field-api';
import type { AgentSession, AgentVisit } from '@/features/cleaning/field-schemas';
import type { Assignment, AssignmentList } from '@/features/cleaning/schemas';
import type { TargetKind } from './actions';

/**
 * Tâches du jour gardées sur le téléphone (IndexedDB `today`, 48 h, par compte) : le planning du jour et
 * les fiches des interventions du jour, pour les lire et y agir sans réseau. **Jamais la position d'une
 * visite** (B6, R-EX-06) : elle est retirée avant la copie. La position d'une séance en cours est gardée
 * avec sa fiche (à valider).
 */

export const PLANNING = 'planning';
const nameOf = (kind: TargetKind, id: string) => `${kind}:${id}`;

/** Visite sans sa position ni ses adresses (`place.location`). */
export function withoutLocation(visit: AgentVisit): AgentVisit {
  return { ...visit, place: { ...visit.place, location: null } };
}

export function cachePlanning(userId: string, list: AssignmentList): Promise<void> {
  return saveToday(userId, PLANNING, list);
}

export function readCachedPlanning(userId: string): Promise<Cached<AssignmentList> | null> {
  return readToday<AssignmentList>(userId, PLANNING);
}

export function cacheVisit(userId: string, visit: AgentVisit): Promise<void> {
  return saveToday(userId, nameOf('visit', visit.id), withoutLocation(visit));
}

export function cacheSession(userId: string, session: AgentSession): Promise<void> {
  return saveToday(userId, nameOf('session', session.id), session);
}

export function readCachedView<V>(userId: string, kind: TargetKind, id: string): Promise<Cached<V> | null> {
  return readToday<V>(userId, nameOf(kind, id));
}

/** Affectation à garder pour la journée : confirmée, proposée ou à confirmer (pas refusée, expirée, retirée). */
const KEPT = new Set(['confirmed', 'proposed', 'pending_confirmation']);

/**
 * Garde les fiches des interventions du jour, l'une après l'autre, en arrière-plan (réseau présent). Une
 * fiche illisible est passée : la journée reste lisible.
 */
export async function prefetchToday(userId: string, assignments: Assignment[], signal?: AbortSignal) {
  for (const assignment of assignments) {
    if (signal?.aborted) return;
    if (!KEPT.has(assignment.status)) continue;
    try {
      if (assignment.target.kind === 'visit') {
        await cacheVisit(userId, await getAgentVisit(assignment.target.id, signal));
      } else if (assignment.target.kind === 'session') {
        await cacheSession(userId, await getAgentSession(assignment.target.id, signal));
      }
    } catch {
      // Fiche illisible (réseau, droits) : elle sera gardée à sa prochaine ouverture.
    }
  }
}
