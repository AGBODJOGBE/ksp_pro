'use client';

import { ApiError } from '@/lib/api';
import { type OutboxEntry, patchEntry } from '@/lib/offline/outbox';
import { uploadFile } from '@/features/file';
import * as fieldApi from '@/features/cleaning/field-api';
import { alreadyDone, type FieldActionType, type FieldView, parseGroup, requestBody } from './actions';

/**
 * Envoi d'une action de la file : dépose d'abord ses photos (déclaration, envoi au stockage, confirmation),
 * garde leur identifiant dans la file (un nouvel essai ne les redépose pas), puis appelle la route avec le
 * corps figé et la clé d'idempotence gardée. Refus `CLEANING_INVALID_TRANSITION` : la fiche est relue ;
 * si l'action y est déjà faite, l'envoi compte comme réussi.
 */

/** Le service file purge un fichier jamais rattaché après 24 h : au-delà de 23 h, la photo est redéposée. */
const UPLOAD_REUSE_MS = 23 * 3_600_000;

function asFile(blob: Blob, name: string): Blob & { name?: string } {
  try {
    return new File([blob], name, { type: blob.type || 'image/jpeg' });
  } catch {
    return blob;
  }
}

async function uploadMissingFiles(entry: OutboxEntry, now: () => number): Promise<void> {
  let changed = false;
  for (const file of entry.files) {
    if (file.fileId && file.uploadedAt && now() - file.uploadedAt < UPLOAD_REUSE_MS) continue;
    try {
      const stored = await uploadFile(asFile(file.blob, file.name), 'cleaning_intervention_photo');
      file.fileId = stored.id;
      file.uploadedAt = now();
      changed = true;
    } catch (error) {
      // Refus du stockage (adresse expirée, réseau du stockage) : nouvel essai plus tard, nouvelle adresse.
      if (error instanceof ApiError && error.code === 'FILE_STORAGE_REJECTED')
        throw new ApiError(503, error.code, error.message);
      throw error;
    }
  }
  if (changed && entry.id > 0) await patchEntry(entry.id, { files: entry.files });
}

function dispatch(type: FieldActionType, id: string, body: Record<string, unknown>, entry: OutboxEntry) {
  const key = entry.key;
  const ref = entry.ref ?? '';
  switch (type) {
    case 'visit.arrive':
      return fieldApi.arriveAtVisit(id, body, key);
    case 'visit.observations':
      return fieldApi.saveVisitObservations(id, body, key);
    case 'visit.photo':
      return fieldApi.addVisitPhoto(id, body, key);
    case 'visit.photo.remove':
      return fieldApi.removeVisitPhoto(id, ref, key);
    case 'visit.complete':
      return fieldApi.completeVisit(id, body, key);
    case 'visit.missed':
      return fieldApi.reportVisitMissed(id, body, key);
    case 'session.arrive':
      return fieldApi.arriveAtSession(id, body, key);
    case 'session.photo':
      return fieldApi.addSessionPhoto(id, body, key);
    case 'session.photo.remove':
      return fieldApi.removeSessionPhoto(id, ref, key);
    case 'session.start':
      return fieldApi.startSession(id, body, key);
    case 'session.checklist':
      return fieldApi.updateSessionChecklist(id, body, key);
    case 'session.incident':
      return fieldApi.reportSessionIncident(id, body, key);
    case 'session.complete':
      return fieldApi.completeSession(id, body, key);
    case 'session.missed':
      return fieldApi.reportSessionMissed(id, body, key);
  }
}

export async function sendFieldEntry(entry: OutboxEntry, now: () => number = Date.now): Promise<FieldView> {
  const { kind, id } = parseGroup(entry.group);
  await uploadMissingFiles(entry, now);
  try {
    return await dispatch(entry.type as FieldActionType, id, requestBody(entry), entry);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CLEANING_INVALID_TRANSITION') {
      const view = kind === 'visit' ? await fieldApi.getAgentVisit(id) : await fieldApi.getAgentSession(id);
      if (alreadyDone(entry, view)) return view;
    }
    throw error;
  }
}
