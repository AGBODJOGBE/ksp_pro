import * as z from 'zod/mini';

/**
 * Réponses de la gateway pour l'agent du Nettoyage (contrat `ksp-api.v1.yaml`, routes
 * `/api/v1/cleaning/agent/*`). Lecture tolérante : un champ ajouté par la gateway est ignoré, et seuls les
 * champs lus par l'écran sont exigés. Montants jamais renvoyés à un agent (R-EX-04).
 */

/**
 * Statuts d'un agent (`CleaningAgent.status`) : candidat, en examen, actif, suspendu, désactivé, refusé.
 * Lu comme une chaîne : un nouveau statut s'affiche avec un libellé neutre plutôt que de casser l'écran.
 */
export const AGENT_STATUSES = [
  'applicant',
  'under_review',
  'active',
  'suspended',
  'deactivated',
  'rejected',
] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/** `CleaningAgent` (`GET /cleaning/agent/me`), réduit à ce que lit le choix de l'espace. */
export const agentProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AgentProfile = z.infer<typeof agentProfileSchema>;
