/**
 * Délai de rejeu d'une action de terrain (R-EX-05) : la gateway refuse une heure réelle de plus de 72 h
 * (`too_old`). L'agent est averti 12 h avant (à valider : seuil de l'avertissement).
 */
export const REPLAY_LIMIT_MS = 72 * 3_600_000;
export const WARN_AFTER_MS = 60 * 3_600_000;

/** L'action approche du délai de 72 h. */
export function nearDeadline(occurredAt: number, now: number): boolean {
  return now - occurredAt >= WARN_AFTER_MS;
}

/** Instant limite d'envoi (ISO). */
export function deadlineOf(occurredAt: number): string {
  return new Date(occurredAt + REPLAY_LIMIT_MS).toISOString();
}
