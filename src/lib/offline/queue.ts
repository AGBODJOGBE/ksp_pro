import { ApiError } from '@/lib/api/errors';
import { listEntries, type OutboxEntry, type OutboxError, patchEntry, removeEntry } from './outbox';

/**
 * Rejeu de la file des actions de terrain (F-022, R-EX-05) :
 *
 * - une action à la fois, dans l'ordre des gestes ; ordre strict par groupe (visite ou séance) : une action
 *   refusée bloque les suivantes de son groupe, les autres groupes continuent ;
 * - réseau coupé, gateway en panne ou limite d'appels : arrêt, l'action reste en attente (même clé) ;
 * - 401 : le client de la gateway a déjà renouvelé la session puis réessayé ; s'il échoue encore, arrêt
 *   (il faut se reconnecter) ;
 * - 403 : l'action est refusée et la file s'arrête ;
 * - autre refus (400, 404, 409, 422…) : l'action est marquée en erreur, son groupe attend l'agent.
 *
 * Un seul rejeu à la fois, dans l'onglet (et entre onglets quand le navigateur offre `navigator.locks`).
 */

export type DrainStop = 'empty' | 'offline' | 'auth' | 'forbidden' | 'busy';

export type Failure = 'transient' | 'auth' | 'forbidden' | 'rejected';

/** Codes HTTP d'une panne passagère : l'action sera réessayée telle quelle. */
const TRANSIENT = new Set([0, 408, 425, 429, 500, 502, 503, 504]);

export function classifyFailure(error: unknown): Failure {
  if (!(error instanceof ApiError)) return 'rejected';
  // Réponse hors contrat : la rejouer donnerait la même (la gateway rejoue la réponse gardée).
  if (error.code === 'INVALID_RESPONSE') return 'rejected';
  if (TRANSIENT.has(error.status)) return 'transient';
  if (error.status === 401) return 'auth';
  if (error.status === 403) return 'forbidden';
  return 'rejected';
}

export function toOutboxError(error: unknown): OutboxError {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      ...(error.correlationId ? { correlationId: error.correlationId } : {}),
      ...(Object.keys(error.details).length ? { details: error.details } : {}),
    };
  }
  return {
    status: 0,
    code: 'CLIENT_ERROR',
    message: error instanceof Error && error.message ? error.message : 'Envoi impossible.',
  };
}

export interface DrainHooks {
  userId: string;
  /** Envoie une action ; renvoie la réponse de la gateway, ou lève l'erreur. */
  send: (entry: OutboxEntry) => Promise<unknown>;
  onStart?: (entry: OutboxEntry) => void;
  onSent?: (entry: OutboxEntry, response: unknown) => void;
  onFailed?: (entry: OutboxEntry, error: OutboxError) => void;
}

const LOCK = 'ksp-pro-outbox';
let running = false;

async function processQueue(hooks: DrainHooks): Promise<DrainStop> {
  for (;;) {
    const entries = await listEntries(hooks.userId);
    const blocked = new Set(entries.filter((entry) => entry.status === 'error').map((entry) => entry.group));
    const next = entries.find((entry) => entry.status === 'pending' && !blocked.has(entry.group));
    if (!next) return 'empty';
    hooks.onStart?.(next);
    let response: unknown;
    try {
      response = await hooks.send(next);
    } catch (error) {
      const failure = classifyFailure(error);
      if (failure === 'transient') {
        await patchEntry(next.id, { attempts: next.attempts + 1 }).catch(() => undefined);
        return 'offline';
      }
      if (failure === 'auth') return 'auth';
      const problem = toOutboxError(error);
      await patchEntry(next.id, { status: 'error', error: problem, attempts: next.attempts + 1 });
      hooks.onFailed?.(next, problem);
      if (failure === 'forbidden') return 'forbidden';
      continue;
    }
    await removeEntry(next.id);
    hooks.onSent?.(next, response);
  }
}

/** Rejoue la file du compte jusqu'au bout, ou jusqu'à un arrêt. `busy` : un rejeu est déjà en cours. */
export async function drainOutbox(hooks: DrainHooks): Promise<DrainStop> {
  if (running) return 'busy';
  running = true;
  try {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (locks?.request) {
      return await locks.request(LOCK, { ifAvailable: true }, (lock) =>
        lock ? processQueue(hooks) : ('busy' as const),
      );
    }
    return await processQueue(hooks);
  } finally {
    running = false;
  }
}
