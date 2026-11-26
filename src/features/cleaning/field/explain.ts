import { formatTime } from '@/lib/format';
import type { OutboxError } from '@/lib/offline/outbox';
import { fieldTexts } from '@/features/cleaning/field-texts';

const t = fieldTexts.errors;

const text = (value: unknown) => (typeof value === 'string' ? value : null);
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Heure lisible d'un instant ISO, ou `null`. */
function timeOf(value: string | null): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return formatTime(value);
}

/** L'heure du geste est refusée (`occurredAt`) : dans le futur ou de plus de 72 h. */
export function occurredAtReason(error: OutboxError | null): 'in_future' | 'too_old' | null {
  if (error?.code !== 'CLEANING_VALIDATION_FAILED' || error.details?.field !== 'occurredAt') return null;
  const reason = error.details.reason;
  return reason === 'in_future' || reason === 'too_old' ? reason : null;
}

/**
 * Explication d'un refus pour l'agent, d'après le code du contrat et ses détails ; sinon le message de la
 * gateway (déjà en français). `scheduled` : heure prévue de l'intervention, si les détails ne la donnent pas.
 */
export function explainError(error: OutboxError, scheduled?: string): string {
  const details = error.details ?? {};
  switch (error.code) {
    case 'CLEANING_VISIT_TOO_EARLY': {
      const time = timeOf(text(details.scheduledAt) ?? scheduled ?? null);
      return time ? t.visitTooEarly(time) : error.message;
    }
    case 'CLEANING_SESSION_TOO_EARLY': {
      const time = timeOf(text(details.scheduledStart) ?? scheduled ?? null);
      const minutes = count(details.maximumMinutes);
      return time && minutes !== null ? t.sessionTooEarly(minutes, time) : error.message;
    }
    case 'CLEANING_SESSION_OVERDUE_PAYMENT':
    case 'CLEANING_BALANCE_GUARANTEE_NOT_MET':
      return t.supervisor;
    case 'CLEANING_PHOTOS_MISSING':
      return details.kind === 'after' ? t.photosMissingAfter : t.photosMissingBefore;
    case 'CLEANING_CHECKLIST_INCOMPLETE':
      return t.checklistIncomplete;
    case 'CLEANING_WAIT_TIME_NOT_ELAPSED': {
      const minutes = count(details.minimumMinutes);
      return minutes !== null ? t.waitNotElapsed(minutes) : error.message;
    }
    case 'CLEANING_TEAM_LEAD_ONLY':
      return t.leadOnly;
    case 'CLEANING_PHOTO_LIMIT_REACHED':
      return t.photoLimit;
    case 'CLEANING_INVALID_TRANSITION':
      return t.invalidTransition;
    case 'CLEANING_VISIT_NOT_FOUND':
    case 'CLEANING_SESSION_NOT_FOUND':
      return t.notFound;
    case 'CLEANING_IDEMPOTENCY_KEY_REUSED':
      return t.keyReused;
    case 'OFFLINE_STORAGE_UNAVAILABLE':
      return t.storage;
    case 'CLEANING_VALIDATION_FAILED': {
      const reason = occurredAtReason(error);
      if (reason === 'in_future') return t.inFuture;
      if (reason === 'too_old') return t.tooOld;
      if (details.field === 'occurredAt' && details.reason === 'out_of_range') return t.outOfRange;
      return error.message;
    }
    default:
      return error.status === 403 && !error.message ? t.forbidden : error.message;
  }
}
