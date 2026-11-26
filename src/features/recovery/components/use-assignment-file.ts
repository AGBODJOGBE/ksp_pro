'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMyAssignment } from '@/features/recovery/api';
import { readProblem } from '@/features/recovery/errors';
import type { AssignmentFile } from '@/features/recovery/schemas';

export type FileState =
  | { status: 'loading' }
  | { status: 'ready'; file: AssignmentFile; readAt: number }
  /** 403 : accès partenaire pas encore actif (prérequis back B1). */
  | { status: 'forbidden' }
  /** 404 `RECOVERY_ASSIGNMENT_NOT_FOUND` : le dossier n'est plus confié. */
  | { status: 'gone' }
  | { status: 'error'; message: string; correlationId?: string };

/**
 * Lecture de la fiche d'un dossier confié. **Chaque `GET` est inscrit au journal d'audit du back** : une
 * seule lecture par ouverture et par « Actualiser » (ou « Réessayer »), jamais d'elle-même. La lecture en
 * cours est gardée par clé (dossier, essai) : le double passage des effets du mode strict de React la
 * reprend au lieu d'en lancer une seconde. Le composant est remonté pour un autre dossier (`key`).
 */
export function useAssignmentFile(id: string) {
  const [state, setState] = useState<FileState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  /** Échec d'une relecture : la fiche déjà lue reste affichée, avec ce message. */
  const [refreshError, setRefreshError] = useState<{ message: string; correlationId?: string } | null>(null);
  const reading = useRef<{ key: string; promise: Promise<AssignmentFile> } | null>(null);
  /** Une fiche est déjà affichée : un échec de relecture ne l'efface pas. */
  const shown = useRef(false);

  useEffect(() => {
    const key = `${id}#${attempt}`;
    if (reading.current?.key !== key) reading.current = { key, promise: getMyAssignment(id) };
    let active = true;
    reading.current.promise.then(
      (file) => {
        if (!active) return;
        setRefreshing(false);
        shown.current = true;
        setState({ status: 'ready', file, readAt: Date.now() });
      },
      (error: unknown) => {
        if (!active) return;
        setRefreshing(false);
        const problem = readProblem(error);
        if (problem.kind === 'forbidden' || problem.kind === 'gone') {
          shown.current = false;
          return setState({ status: problem.kind });
        }
        const failure = {
          message: 'message' in problem ? problem.message : '',
          correlationId: problem.kind === 'other' ? problem.correlationId : undefined,
        };
        if (shown.current) setRefreshError(failure);
        else setState({ status: 'error', ...failure });
      },
    );
    return () => {
      active = false;
    };
  }, [id, attempt]);

  /** « Actualiser » ou « Réessayer » : une nouvelle lecture, demandée par la personne. */
  const reload = useCallback(() => {
    setRefreshError(null);
    setRefreshing(true);
    setState((previous) => (previous.status === 'ready' ? previous : { status: 'loading' }));
    setAttempt((value) => value + 1);
  }, []);

  /** Un envoi a répondu 404 ou 403 : la fiche change d'état sans nouvelle lecture. */
  const settle = useCallback((status: 'gone' | 'forbidden') => {
    shown.current = false;
    setState({ status });
  }, []);

  return { state, reload, refreshing, refreshError, settle };
}
