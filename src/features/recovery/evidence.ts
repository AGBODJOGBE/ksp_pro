/*
 * Pièces du Recouvrement déposées par le partenaire (finalité `recovery_evidence` du service file) : acte,
 * preuve d'un encaissement. Le champ vit ici et non dans `features/file`, dont l'index est lu par les fiches
 * de terrain du Nettoyage : elles n'en sont pas alourdies.
 */

/** Types acceptés : PDF, JPEG, PNG, WebP. */
export const EVIDENCE_TYPES: ReadonlyArray<string> = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/** Poids maximal d'une pièce (10 Mo). */
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
