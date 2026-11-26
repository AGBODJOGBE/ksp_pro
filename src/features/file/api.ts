'use client';

import { api, parseResponse } from '@/lib/api';
// Hors de l'index de `lib/api` : seul le dépôt de fichiers télécharge cet envoi.
import { putToStorage } from '@/lib/api/upload';
import type { StoredFile } from './schemas';

/**
 * Finalités utilisées par l'Espace pro (`FileUploadPurpose`) : photos du Nettoyage (la candidature d'un
 * agent l'emprunte aussi pour sa photo et sa pièce d'identité, faute de finalité propre : à valider avec
 * le back, voir `features/cleaning/application/files.ts`) ; pièces du Recouvrement (acte, preuve d'un
 * encaissement).
 */
export type FilePurpose = 'cleaning_intervention_photo' | 'recovery_evidence';

/** Types acceptés pour une photo du Nettoyage (contrat de `POST /file/uploads`). */
export const PHOTO_TYPES: ReadonlyArray<string> = ['image/jpeg', 'image/png', 'image/webp'];

/** Poids maximal d'une photo du Nettoyage (8 Mo, service file). */
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

const UPLOADS = '/api/v1/file/uploads';
const completePath = (id: string) => `/api/v1/file/files/${encodeURIComponent(id)}/complete`;

/**
 * Dépose un fichier en trois temps (ADR-038) : déclaration (`POST /file/uploads`), envoi direct au
 * stockage (`PUT` présigné, jamais par la gateway), confirmation (`POST /file/files/{id}/complete`).
 * Renvoie le fichier disponible, dont l'identifiant part ensuite avec l'action métier qui le rattache.
 * Un fichier jamais rattaché est purgé par le service file après 24 heures.
 */
export async function uploadFile(file: Blob & { name?: string }, purpose: FilePurpose, signal?: AbortSignal) {
  const [{ fileUploadSchema, storedFileSchema }, declaredBody] = await Promise.all([
    import('./schemas'),
    api.post(
      UPLOADS,
      { purpose, fileName: file.name || 'photo.jpg', contentType: file.type, sizeBytes: file.size },
      { signal },
    ),
  ]);
  const declared = parseResponse(fileUploadSchema, declaredBody);
  await putToStorage(declared.upload.url, declared.upload.headers, file, signal);
  const stored: StoredFile = parseResponse(
    storedFileSchema,
    await api.post(completePath(declared.file.id), undefined, { signal }),
  );
  return stored;
}
