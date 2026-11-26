import * as z from 'zod/mini';

/**
 * Réponses de la gateway pour l'agent et le candidat du Nettoyage (contrat `ksp-api.v1.yaml`, routes
 * `/api/v1/cleaning/agent/*`, `/api/v1/cleaning/catalog/zones`), champ par champ. Lecture tolérante : un
 * champ ajouté par la gateway est ignoré ; un statut nouveau est lu comme une chaîne et s'affiche avec un
 * libellé neutre plutôt que de casser l'écran. Montants jamais renvoyés à un agent (R-EX-04).
 *
 * Chargé à la demande (`Promise.all([import('./schemas'), api.get(…)])`) : zod reste hors du premier
 * chargement des écrans.
 */

/** Statuts d'un agent (`CleaningAgent.status`) : candidat, en examen, actif, suspendu, désactivé, refusé. */
export const AGENT_STATUSES = [
  'applicant',
  'under_review',
  'active',
  'suspended',
  'deactivated',
  'rejected',
] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

const emergencyContactSchema = z.object({ name: z.string(), phone: z.string() });

/** `CleaningAgentStats` : activité sans montants (R-AG-04). */
export const agentStatsSchema = z.object({
  sessionsCompleted: z.int(),
  visitsCompleted: z.int(),
  hoursThisWeek: z.number(),
  hoursThisMonth: z.number(),
  ratingAverage: z.nullable(z.number()),
  ratingsCount: z.int(),
  openClaims: z.int(),
});

/** `CleaningAgent` (`GET /cleaning/agent/me`, réponse de `POST /cleaning/agent/applications`). */
export const agentProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  /** Lien temporaire vers la photo, ou `null`. */
  photoUrl: z.nullable(z.string()),
  /** `employee` (salarié) ou `independent` (indépendant partenaire, R-PL-08). */
  employmentKind: z.string(),
  residenceCommuneKey: z.string(),
  zoneKeys: z.array(z.string()),
  skills: z.array(z.object({ code: z.string(), name: z.string(), validated: z.boolean() })),
  maxHoursPerDay: z.int(),
  maxHoursPerWeek: z.int(),
  emergencyContact: emergencyContactSchema,
  mobileMoneyNumber: z.nullable(z.string()),
  hasIdDocument: z.boolean(),
  stats: agentStatsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgentProfile = z.infer<typeof agentProfileSchema>;

/** `CleaningPublicZoneList` (`GET /cleaning/catalog/zones`, public) : communes desservies, par nom. */
export const publicZoneListSchema = z.object({
  data: z.array(z.object({ communeKey: z.string(), name: z.string() })),
});
export type PublicZone = z.infer<typeof publicZoneListSchema>['data'][number];

/** `CleaningSkillList` (`GET /admin/cleaning/skills`, back-office) : lu seulement si la gateway l'accepte. */
export const skillListSchema = z.object({
  data: z.array(z.object({ id: z.string(), code: z.string(), name: z.string(), active: z.boolean() })),
  nextCursor: z.nullable(z.string()),
});

/** `CleaningAgentAssignmentView` : affectation vue par l'agent, sans montants ni position. */
export const assignmentSchema = z.object({
  assignmentId: z.string(),
  target: z.object({ kind: z.string(), id: z.string() }),
  /** `proposed`, `pending_confirmation`, `confirmed`, `declined`, `expired`, `removed`. */
  status: z.string(),
  isLead: z.boolean(),
  start: z.string(),
  end: z.string(),
  /** Statut de la visite ou de la séance. */
  targetStatus: z.string(),
  placeTypeName: z.string(),
  communeName: z.string(),
  /** Échéance de réponse d'un indépendant ; `null` sinon. */
  respondBefore: z.nullable(z.string()),
});
export type Assignment = z.infer<typeof assignmentSchema>;

export const assignmentListSchema = z.object({
  data: z.array(assignmentSchema),
  nextCursor: z.nullable(z.string()),
  total: z.int(),
});
export type AssignmentList = z.infer<typeof assignmentListSchema>;

const timeRangeSchema = z.object({ start: z.string(), end: z.string() });

/** `CleaningAvailabilityRule` : plages d'un jour de la semaine, heure de Porto-Novo. */
export const availabilityRuleSchema = z.object({
  weekday: z.string(),
  ranges: z.array(timeRangeSchema),
});

/** `CleaningAvailability` (`GET`/`PUT /me/availability`, `POST`/`DELETE /me/unavailabilities`). */
export const availabilitySchema = z.object({
  weekly: z.array(availabilityRuleSchema),
  extraAvailabilities: z.array(z.object({ id: z.string(), start: z.string(), end: z.string() })),
  unavailabilities: z.array(
    z.object({
      id: z.string(),
      start: z.string(),
      end: z.string(),
      /** `leave`, `sickness` ou `other`. */
      kind: z.string(),
      note: z.nullable(z.string()),
      /** Forcée par le superviseur malgré des affectations (R-DS-04). */
      forced: z.boolean(),
      createdByName: z.nullable(z.string()),
    }),
  ),
  maxHoursPerDay: z.int(),
  maxHoursPerWeek: z.int(),
});
export type Availability = z.infer<typeof availabilitySchema>;
export type Unavailability = Availability['unavailabilities'][number];

const activityPeriodSchema = z.object({
  /** Début de la période (`AAAA-MM-JJ`). */
  periodStart: z.string(),
  hours: z.number(),
  sessionsCompleted: z.int(),
});

/** `CleaningAgentActivity` (`GET /me/activity`) : heures et séances, sans montants. */
export const activitySchema = z.object({
  stats: agentStatsSchema,
  weeks: z.array(activityPeriodSchema),
  months: z.array(activityPeriodSchema),
});
export type Activity = z.infer<typeof activitySchema>;
export type ActivityPeriod = Activity['weeks'][number];
