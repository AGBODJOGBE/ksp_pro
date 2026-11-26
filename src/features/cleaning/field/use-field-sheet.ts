'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import type { OutboxEntry } from '@/lib/offline/outbox';
import { classifyFailure } from '@/lib/offline/queue';
import { getAgentSession, getAgentVisit } from '@/features/cleaning/field-api';
import type { AgentSession, AgentVisit } from '@/features/cleaning/field-schemas';
import { fieldTexts } from '@/features/cleaning/field-texts';
import { type FieldActionType, type FieldView, groupOf, type TargetKind } from './actions';
import { explainError } from './explain';
import {
  discardEntry,
  entriesOf,
  type FieldAction,
  type OutboxSnapshot,
  submitFieldAction,
  subscribeViews,
  useOutbox,
} from './outbox';
import { cacheSession, cacheVisit, readCachedView } from './today-cache';

export { useFieldAccount } from './account';

export type SheetState<V> =
  | { status: 'loading' }
  /** `savedAt` : fiche lue dans la copie du téléphone (réseau absent), avec son heure. */
  | { status: 'ready'; view: V; savedAt: number | null }
  | { status: 'error'; message: string; correlationId?: string };

const loaders = {
  visit: (id: string, signal: AbortSignal) => getAgentVisit(id, signal),
  session: (id: string, signal: AbortSignal) => getAgentSession(id, signal),
};

function cache(userId: string, kind: TargetKind, view: FieldView) {
  return kind === 'visit'
    ? cacheVisit(userId, view as AgentVisit)
    : cacheSession(userId, view as AgentSession);
}

/**
 * Fiche d'une visite ou d'une séance : la copie du téléphone d'abord (affichage immédiat, et sans réseau),
 * puis la gateway. Chaque fiche reçue (lecture, action, rejeu de la file) est gardée pour la journée.
 */
export function useFieldSheet<V extends FieldView>(
  kind: TargetKind,
  id: string | null,
  userId: string | null,
) {
  const [state, setState] = useState<SheetState<V>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const accept = useCallback(
    (view: V) => {
      setState({ status: 'ready', view, savedAt: null });
      if (userId) void cache(userId, kind, view);
    },
    [kind, userId],
  );

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    let fresh = false;
    if (userId)
      void readCachedView<V>(userId, kind, id).then((cached) => {
        if (cached && !fresh && !controller.signal.aborted)
          setState({ status: 'ready', view: cached.data, savedAt: cached.savedAt });
      });
    (loaders[kind](id, controller.signal) as Promise<V>).then(
      (view) => {
        if (controller.signal.aborted) return;
        fresh = true;
        accept(view);
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (classifyFailure(error) === 'transient') {
          // Sans réseau : la copie du téléphone reste affichée, si elle existe.
          setState((current) =>
            current.status === 'ready' ? current : { status: 'error', message: fieldTexts.offlineNever },
          );
          return;
        }
        const notFound = error instanceof ApiError && error.status === 404;
        setState({
          status: 'error',
          message: notFound
            ? fieldTexts.notFound
            : error instanceof ApiError
              ? error.message
              : fieldTexts.errors.invalidTransition,
          correlationId: error instanceof ApiError && !notFound ? error.correlationId : undefined,
        });
      },
    );
    return () => controller.abort();
  }, [kind, id, userId, attempt, accept]);

  // Fiche renvoyée par le rejeu de la file (geste fait hors connexion, envoyé au retour du réseau).
  useEffect(() => {
    if (!id) return;
    const group = groupOf(kind, id);
    return subscribeViews((from, view) => {
      if (from === group) accept(view as V);
    });
  }, [kind, id, accept]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  return { state, reload, accept };
}

export interface GestureResult {
  /** Message d'erreur à afficher près du bouton. */
  error: string | null;
  /** Geste gardé sur le téléphone (hors connexion). */
  queued: boolean;
}

/**
 * Envoi d'un geste de terrain depuis une fiche : gardé dans la file, envoyé si le réseau est là. Refusé :
 * il sort de la file et son explication s'affiche près du bouton (l'agent refait le geste). `busy` : le
 * geste en cours (boutons désactivés).
 */
export function useGesture<V extends FieldView>(options: {
  kind: TargetKind;
  id: string | null;
  userId: string | null;
  scheduled: string | undefined;
  context: string;
  onView: (view: V) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ action: string; outcome: GestureResult } | null>(null);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const run = useCallback(
    async (
      name: string,
      type: FieldActionType,
      body: Record<string, unknown>,
      extra: Pick<FieldAction, 'files' | 'ref' | 'label'> & { quiet?: boolean } = {},
    ): Promise<boolean> => {
      const { kind, id, userId, scheduled, context, onView } = latest.current;
      if (!id || !userId) return false;
      const { quiet, ...action } = extra;
      // Geste « discret » (case de la liste) : les autres boutons restent actifs, la file garde l'ordre.
      if (!quiet) setBusy(name);
      setResult(null);
      try {
        const outcome = await submitFieldAction({
          userId,
          kind,
          targetId: id,
          type,
          body,
          context,
          ...action,
        });
        if (outcome.status === 'sent') {
          onView(outcome.view as V);
          return true;
        }
        if (outcome.status === 'queued') {
          setResult({ action: name, outcome: { error: null, queued: true } });
          return true;
        }
        // Geste refusé : il sort de la file, l'agent le refera (l'explication s'affiche près du bouton).
        if (outcome.entryId !== undefined) await discardEntry(outcome.entryId).catch(() => undefined);
        setResult({
          action: name,
          outcome: { error: explainError(outcome.error, scheduled), queued: false },
        });
        return false;
      } finally {
        if (!quiet) setBusy(null);
      }
    },
    [],
  );

  const messageFor = (name: string): GestureResult | null =>
    result && result.action === name ? result.outcome : null;
  const clear = useCallback(() => setResult(null), []);
  return { run, busy, messageFor, clear };
}

/** Actions de la file pour cette fiche, et le rejeu en cours. */
export function useSheetOutbox(kind: TargetKind, id: string | null, userId: string | null) {
  const snapshot: OutboxSnapshot = useOutbox(userId);
  const entries: OutboxEntry[] = useMemo(
    () => (id ? entriesOf(snapshot, kind, id) : []),
    [snapshot, kind, id],
  );
  return { entries, inFlight: snapshot.inFlight, stop: snapshot.stop };
}
