'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { createIdempotencyKey } from '@/lib/idempotency';
import {
  addEntry,
  listEntries,
  type NewOutboxEntry,
  type OutboxEntry,
  type OutboxError,
  type OutboxFile,
  patchEntry,
  removeEntry,
  subscribeOutbox,
} from '@/lib/offline/outbox';
import { classifyFailure, type DrainStop, drainOutbox, toOutboxError } from '@/lib/offline/queue';
import { type FieldActionType, type FieldView, groupOf, type TargetKind } from './actions';
import { sendFieldEntry } from './send';

/**
 * File d'attente des actions de terrain, côté écrans : chaque geste est gardé avant tout envoi (rien n'est
 * perdu si l'application se ferme), puis la file est rejouée aussitôt si le réseau est là. L'écran attend
 * l'issue de son geste : envoyé (fiche à jour), en attente (hors connexion, panne, actions plus anciennes
 * de la même intervention), ou refusé (message près du bouton ; l'action sort alors de la file).
 *
 * Rejeu : au geste, au retour du réseau (`online`), au retour au premier plan et au démarrage de l'espace
 * agent (`FieldRuntime`). Pas de Background Sync.
 */

export type Outcome =
  | { status: 'sent'; view: FieldView }
  | { status: 'queued' }
  | { status: 'failed'; error: OutboxError; entryId?: number };

export interface FieldAction {
  userId: string;
  kind: TargetKind;
  targetId: string;
  type: FieldActionType;
  /** Corps figé au geste, `occurredAt` compris (sauf retrait d'une photo). */
  body: Record<string, unknown>;
  ref?: string;
  files?: Array<Pick<OutboxFile, 'field' | 'blob' | 'name'>>;
  /** Détail affiché dans « Envois en attente » (point de la liste de contrôle…). */
  label?: string;
  /** Intervention affichée dans « Envois en attente » (« Villa · Cotonou »). */
  context?: string;
}

export interface OutboxSnapshot {
  userId: string | null;
  entries: OutboxEntry[];
  /** Action en cours d'envoi. */
  inFlight: number | null;
  /** Dernier arrêt du rejeu (`auth` : se reconnecter). */
  stop: DrainStop | null;
}

const EMPTY: OutboxSnapshot = { userId: null, entries: [], inFlight: null, stop: null };
let snapshot: OutboxSnapshot = EMPTY;
const listeners = new Set<() => void>();
const waiters = new Map<number, (outcome: Outcome) => void>();
const viewListeners = new Set<(group: string, view: FieldView) => void>();

function emit(patch: Partial<OutboxSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

async function refresh(userId: string) {
  const entries = await listEntries(userId);
  if (snapshot.userId === userId || snapshot.userId === null) emit({ userId, entries });
}

subscribeOutbox(() => {
  if (snapshot.userId) void refresh(snapshot.userId);
});

function settle(id: number, outcome: Outcome) {
  waiters.get(id)?.(outcome);
  waiters.delete(id);
}

/** Prévenu de chaque fiche renvoyée par la gateway pendant le rejeu (les écrans ouverts se mettent à jour). */
export function subscribeViews(listener: (group: string, view: FieldView) => void): () => void {
  viewListeners.add(listener);
  return () => {
    viewListeners.delete(listener);
  };
}

const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

let draining: Promise<void> | null = null;
let again = false;

/** Rejoue la file du compte (un seul rejeu à la fois ; un geste pendant le rejeu est pris à sa suite). */
export function flushOutbox(userId: string): Promise<void> {
  if (draining) {
    again = true;
    return draining;
  }
  draining = (async () => {
    let stop: DrainStop = 'empty';
    do {
      again = false;
      stop = await drainOutbox({
        userId,
        send: (entry) => sendFieldEntry(entry),
        onStart: (entry) => emit({ inFlight: entry.id }),
        onSent: (entry, view) => {
          settle(entry.id, { status: 'sent', view: view as FieldView });
          viewListeners.forEach((listener) => listener(entry.group, view as FieldView));
        },
        onFailed: (entry, error) => settle(entry.id, { status: 'failed', error, entryId: entry.id }),
      }).catch((): DrainStop => 'offline');
    } while (again && stop === 'empty');
    emit({ inFlight: null, stop });
    // Gestes que ce rejeu n'a pas pu envoyer : ils restent dans la file.
    [...waiters.keys()].forEach((id) => settle(id, { status: 'queued' }));
  })().finally(() => {
    draining = null;
  });
  return draining;
}

/** Garde le geste dans la file, puis l'envoie si le réseau est là. */
export async function submitFieldAction(action: FieldAction, now = Date.now()): Promise<Outcome> {
  const occurredAt = typeof action.body.occurredAt === 'string' ? Date.parse(action.body.occurredAt) : now;
  const entry: NewOutboxEntry = {
    userId: action.userId,
    group: groupOf(action.kind, action.targetId),
    type: action.type,
    body: action.body,
    ...(action.ref ? { ref: action.ref } : {}),
    ...(action.label ? { label: action.label } : {}),
    ...(action.context ? { context: action.context } : {}),
    key: createIdempotencyKey(),
    occurredAt: Number.isFinite(occurredAt) ? occurredAt : now,
    files: (action.files ?? []).map((file) => ({ field: file.field, blob: file.blob, name: file.name })),
  };
  let id: number;
  try {
    id = await addEntry(entry);
  } catch {
    return sendWithoutStorage(entry);
  }
  if (!online()) return { status: 'queued' };
  const outcome = new Promise<Outcome>((resolve) => waiters.set(id, resolve));
  void flushOutbox(action.userId);
  return outcome;
}

/**
 * Appareil sans stockage (navigation privée, stockage plein) : envoi direct, sans file d'attente. Hors
 * connexion, le geste est refusé avec une explication.
 */
async function sendWithoutStorage(entry: NewOutboxEntry): Promise<Outcome> {
  const unavailable: OutboxError = {
    status: 0,
    code: 'OFFLINE_STORAGE_UNAVAILABLE',
    message:
      'Ce téléphone ne peut pas garder l’action hors connexion (stockage indisponible). Réessayez avec du réseau.',
  };
  if (!online()) return { status: 'failed', error: unavailable };
  try {
    const view = await sendFieldEntry({ ...entry, id: -1, status: 'pending', error: null, attempts: 0 });
    return { status: 'sent', view };
  } catch (error) {
    return {
      status: 'failed',
      error: classifyFailure(error) === 'transient' ? unavailable : toOutboxError(error),
    };
  }
}

/** Retire une action de la file (geste annulé, ou refus que l'agent abandonne). */
export async function discardEntry(id: number): Promise<void> {
  await removeEntry(id);
}

/** Action refusée remise en attente (« Réessayer »), éventuellement sans son heure (heure de réception). */
export async function retryEntry(entry: OutboxEntry, options: { withoutTime?: boolean } = {}) {
  const patch: Partial<OutboxEntry> = { status: 'pending', error: null };
  if (options.withoutTime) {
    const body = { ...entry.body };
    delete body.occurredAt;
    // Corps modifié : nouvelle clé (l'ancienne n'a jamais été acceptée).
    Object.assign(patch, { body, key: createIdempotencyKey() });
  }
  await patchEntry(entry.id, patch);
  await flushOutbox(entry.userId);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** File du compte, à jour à chaque changement. */
export function useOutbox(userId: string | null): OutboxSnapshot {
  useEffect(() => {
    if (!userId) return;
    if (snapshot.userId !== userId) emit({ ...EMPTY, userId });
    void refresh(userId);
  }, [userId]);
  const current = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
  return userId && current.userId === userId ? current : EMPTY;
}

/** Actions en attente d'une visite ou d'une séance, dans l'ordre des gestes. */
export function entriesOf(current: OutboxSnapshot, kind: TargetKind, id: string): OutboxEntry[] {
  const group = groupOf(kind, id);
  return current.entries.filter((entry) => entry.group === group);
}
