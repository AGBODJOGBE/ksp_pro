import { ApiError } from '@/lib/api';
import { recoveryTexts as t } from './texts';

/**
 * Lecture d'un refus de la gateway pour l'espace partenaire. Le contrat ne liste pas les codes de ces
 * routes : ceux du service recovery (`services/recovery`, origin/main) sont lus ici.
 *
 * - `forbidden` (403) : accès partenaire pas encore actif (prérequis back B1 : routes contrôlées sur les
 *   rôles du jeton, qui ne portent que `customer` sur le web) ;
 * - `gone` (404 `RECOVERY_ASSIGNMENT_NOT_FOUND`) : le dossier n'est plus confié au partenaire ;
 * - `field` (400 `RECOVERY_VALIDATION_FAILED`, `details.field`) : le champ en cause ;
 * - `suspended` (422 `RECOVERY_CASE_SUSPENDED`) : contestation en cours ;
 * - `amount` (422 `RECOVERY_PAYMENT_AMOUNT_INVALID`, `details.due`) : au-delà du reste dû ;
 * - `keyReused` (409 `RECOVERY_IDEMPOTENCY_KEY_REUSED`), `transition` (422 `RECOVERY_INVALID_TRANSITION`) ;
 * - `other` : le message de la gateway (en français), avec sa référence pour le support.
 */
export type RecoveryProblem =
  | { kind: 'forbidden' }
  | { kind: 'gone' }
  | { kind: 'field'; field: string; message: string }
  | { kind: 'suspended' }
  | { kind: 'amount'; message: string; due: number | null }
  | { kind: 'keyReused'; message: string }
  | { kind: 'transition'; message: string }
  | { kind: 'other'; message: string; correlationId?: string };

function dueOf(details: Record<string, unknown>): number | null {
  const due = details.due as { amount?: unknown } | undefined;
  return typeof due?.amount === 'number' ? due.amount : null;
}

export function readProblem(error: unknown): RecoveryProblem {
  if (!(error instanceof ApiError)) return { kind: 'other', message: t.genericError };
  if (error.status === 403) return { kind: 'forbidden' };
  if (error.status === 404 && error.code === 'RECOVERY_ASSIGNMENT_NOT_FOUND') return { kind: 'gone' };
  switch (error.code) {
    case 'RECOVERY_VALIDATION_FAILED': {
      const field = error.details.field;
      return typeof field === 'string'
        ? { kind: 'field', field, message: error.message }
        : {
            kind: 'other',
            message: error.message || t.errors.validation,
            correlationId: error.correlationId,
          };
    }
    case 'RECOVERY_CASE_SUSPENDED':
      return { kind: 'suspended' };
    case 'RECOVERY_PAYMENT_AMOUNT_INVALID':
      return { kind: 'amount', message: error.message, due: dueOf(error.details) };
    case 'RECOVERY_IDEMPOTENCY_KEY_REUSED':
      return { kind: 'keyReused', message: t.errors.keyReused };
    case 'RECOVERY_INVALID_TRANSITION':
      return { kind: 'transition', message: t.errors.invalidTransition };
    default:
      return { kind: 'other', message: error.message, correlationId: error.correlationId };
  }
}

/** Message affichable avec sa référence (support). */
export function withReference(message: string, correlationId?: string): string {
  return correlationId ? `${message} (${t.reference(correlationId)})` : message;
}
