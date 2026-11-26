import * as z from 'zod/mini';

/**
 * Fiches de terrain de l'agent (contrat `ksp-api.v1.yaml` : `CleaningAgentVisitView`,
 * `CleaningAgentSessionView`), renvoyées par `GET /cleaning/agent/visits|sessions/{id}` et par chacune des
 * 14 actions de terrain. Lecture tolérante, comme `./schemas` : un champ ajouté est ignoré, un statut
 * nouveau est lu comme une chaîne. Aucun montant (R-EX-04). Chargé à la demande, pendant l'appel.
 */

const photoSchema = z.object({
  fileId: z.string(),
  /** `visit`, `absence`, `before`, `after`, `incident`… */
  kind: z.string(),
  takenAt: z.string(),
  /** Lien temporaire de lecture ; `null` si la photo n'est plus conservée. */
  url: z.nullable(z.string()),
  urlExpiresAt: z.nullable(z.string()),
});

const arrivalSchema = z.object({
  arrivedAt: z.string(),
  distanceMeters: z.nullable(z.number()),
  alert: z.boolean(),
  placeAccuracyMeters: z.nullable(z.number()),
  arrivalAccuracyMeters: z.nullable(z.number()),
  uncertain: z.boolean(),
});

const locationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  landmark: z.string(),
  address: z.nullable(z.string()),
  readableAddress: z.nullable(z.string()),
  accuracyMeters: z.nullable(z.number()),
});

/** `CleaningAgentPlaceView` : `location` nulle hors de la visite ou de la séance en cours (R-EX-06, B6). */
const placeSchema = z.object({
  name: z.string(),
  placeTypeName: z.string(),
  communeName: z.string(),
  location: z.nullable(locationSchema),
  customerFirstName: z.string(),
});

const parameterSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  /** `number`, `choice` ou `boolean`. */
  kind: z.string(),
  unit: z.nullable(z.string()),
  min: z.nullable(z.number()),
  max: z.nullable(z.number()),
  choices: z.array(z.object({ code: z.string(), label: z.string(), active: z.boolean() })),
  required: z.boolean(),
  help: z.nullable(z.string()),
  active: z.boolean(),
});

/** `CleaningValues` : code du paramètre → entier, code de choix ou oui/non. */
const valuesSchema = z.record(z.string(), z.union([z.number(), z.string(), z.boolean()]));

export const agentVisitSchema = z.object({
  id: z.string(),
  requestNumber: z.string(),
  /** `scheduled`, `in_progress`, `completed`, `missed`, `cancelled`. */
  status: z.string(),
  scheduledAt: z.string(),
  durationMinutes: z.number(),
  isLead: z.boolean(),
  place: placeSchema,
  cleaningTypes: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })),
  parameters: z.array(parameterSchema),
  declaredValues: valuesSchema,
  observedValues: z.nullable(valuesSchema),
  photos: z.array(photoSchema),
  arrival: z.nullable(arrivalSchema),
  completedAt: z.nullable(z.string()),
  note: z.nullable(z.string()),
});

const teamMemberSchema = z.object({
  agentId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  photoUrl: z.nullable(z.string()),
  isLead: z.boolean(),
  /** `confirmed`, `pending`, `proposed`. */
  confirmation: z.string(),
});

const checklistItemSchema = z.object({
  code: z.string(),
  label: z.string(),
  /** `null` : point commun à tous les types de nettoyage. */
  cleaningTypeCode: z.nullable(z.string()),
  checked: z.boolean(),
  checkedAt: z.nullable(z.string()),
});

const incidentSchema = z.object({
  id: z.string(),
  category: z.string(),
  note: z.string(),
  photos: z.array(photoSchema),
  reportedAt: z.string(),
  /** `pending`, `resumed`, `rescheduled`, `cancelled` : décision du superviseur. */
  decision: z.string(),
  decidedAt: z.nullable(z.string()),
});

export const agentSessionSchema = z.object({
  id: z.string(),
  programNumber: z.string(),
  rank: z.number(),
  /** `assigned`, `in_progress`, `interrupted`, `completed`, `missed`, `suspended`, `cancelled`… */
  status: z.string(),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  isLead: z.boolean(),
  team: z.array(teamMemberSchema),
  place: placeSchema,
  checklist: z.array(checklistItemSchema),
  photos: z.array(photoSchema),
  incidents: z.array(incidentSchema),
  arrival: z.nullable(arrivalSchema),
  startedAt: z.nullable(z.string()),
  completedAt: z.nullable(z.string()),
});

export type AgentVisit = z.infer<typeof agentVisitSchema>;
export type AgentSession = z.infer<typeof agentSessionSchema>;
export type FieldPhoto = AgentVisit['photos'][number];
export type FieldArrival = NonNullable<AgentVisit['arrival']>;
export type FieldPlace = AgentVisit['place'];
export type VisitParameter = AgentVisit['parameters'][number];
export type FieldValues = AgentVisit['declaredValues'];
export type ChecklistItem = AgentSession['checklist'][number];
export type FieldIncident = AgentSession['incidents'][number];
export type TeamMember = AgentSession['team'][number];
