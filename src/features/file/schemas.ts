import * as z from 'zod/mini';

/*
 * Fichiers déposés par le compte connecté (service file, ADR-038 ; contrat `POST /file/uploads` et
 * `POST /file/files/{id}/complete`), lus dans le navigateur. Lecture tolérante : un champ ajouté est ignoré.
 */

export const storedFileSchema = z.object({
  id: z.string(),
  purpose: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.int(),
  /** `pending`, `available` ou `rejected`. */
  status: z.string(),
  createdAt: z.string(),
  completedAt: z.nullable(z.string()),
});
export type StoredFile = z.infer<typeof storedFileSchema>;

export const fileUploadSchema = z.object({
  file: storedFileSchema,
  upload: z.object({
    url: z.string(),
    method: z.literal('PUT'),
    headers: z.record(z.string(), z.string()),
    expiresAt: z.string(),
  }),
});
