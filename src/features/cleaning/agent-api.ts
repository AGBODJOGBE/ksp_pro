'use client';

import { api, parseResponse } from '@/lib/api';
import type { Activity, Assignment, AssignmentList, Availability } from './schemas';

/**
 * Appels de l'espace agent du Nettoyage (`/api/v1/cleaning/agent/*`, permission
 * `cleaning.session.perform`) : planning, réponse d'un indépendant, disponibilités, indisponibilités,
 * activité. Sans montants (R-EX-04). Schémas chargés pendant l'appel (hors du premier chargement).
 */

const ASSIGNMENTS = '/api/v1/cleaning/agent/me/assignments';
const acceptPath = (id: string) => `/api/v1/cleaning/agent/assignments/${encodeURIComponent(id)}/accept`;
const declinePath = (id: string) => `/api/v1/cleaning/agent/assignments/${encodeURIComponent(id)}/decline`;
const AVAILABILITY = '/api/v1/cleaning/agent/me/availability';
const UNAVAILABILITIES = '/api/v1/cleaning/agent/me/unavailabilities';
const unavailabilityPath = (id: string) =>
  `/api/v1/cleaning/agent/me/unavailabilities/${encodeURIComponent(id)}`;
const ACTIVITY = '/api/v1/cleaning/agent/me/activity';

const schemas = () => import('./schemas');

/** Statuts d'une affectation (`status` de `GET /me/assignments`), dans l'ordre des onglets. */
export const ASSIGNMENT_STATUSES = [
  'pending_confirmation',
  'confirmed',
  'proposed',
  'declined',
  'expired',
  'removed',
] as const;
export type AssignmentStatusFilter = (typeof ASSIGNMENT_STATUSES)[number];

export interface AssignmentQuery {
  /** Début de la période (incluse), ISO 8601 ; défaut de la gateway : début du jour. */
  from?: string;
  /** Fin de la période (exclue) ; défaut de la gateway : 7 jours. */
  to?: string;
  status?: AssignmentStatusFilter;
  limit?: number;
  cursor?: string;
}

/** Mon planning (`GET /me/assignments`), dans l'ordre chronologique. */
export async function listMyAssignments(
  query: AssignmentQuery,
  signal?: AbortSignal,
): Promise<AssignmentList> {
  const [{ assignmentListSchema }, body] = await Promise.all([
    schemas(),
    api.get(ASSIGNMENTS, { query: { ...query, sort: 'start' }, signal }),
  ]);
  return parseResponse(assignmentListSchema, body);
}

export type AssignmentAnswer = 'accept' | 'decline';

/** Réponse d'un indépendant à une affectation (avant `respondBefore`), avec sa clé d'idempotence. */
export async function respondToAssignment(
  id: string,
  answer: AssignmentAnswer,
  idempotencyKey: string,
): Promise<Assignment> {
  const request =
    answer === 'accept'
      ? api.post(acceptPath(id), undefined, { idempotencyKey })
      : api.post(declinePath(id), undefined, { idempotencyKey });
  const [{ assignmentSchema }, body] = await Promise.all([schemas(), request]);
  return parseResponse(assignmentSchema, body);
}

export async function getMyAvailability(signal?: AbortSignal): Promise<Availability> {
  const [{ availabilitySchema }, body] = await Promise.all([schemas(), api.get(AVAILABILITY, { signal })]);
  return parseResponse(availabilitySchema, body);
}

/** Corps de `PUT /me/availability` : remplace la semaine type et les disponibilités exceptionnelles. */
export interface AvailabilityBody {
  weekly: Array<{ weekday: string; ranges: Array<{ start: string; end: string }> }>;
  extraAvailabilities: Array<{ start: string; end: string }>;
}

export async function setMyAvailability(body: AvailabilityBody): Promise<Availability> {
  const [{ availabilitySchema }, response] = await Promise.all([schemas(), api.put(AVAILABILITY, body)]);
  return parseResponse(availabilitySchema, response);
}

export type UnavailabilityKind = 'leave' | 'sickness' | 'other';

export interface UnavailabilityBody {
  start: string;
  end: string;
  kind: UnavailabilityKind;
  note?: string;
}

export async function declareUnavailability(
  body: UnavailabilityBody,
  idempotencyKey: string,
): Promise<Availability> {
  const [{ availabilitySchema }, response] = await Promise.all([
    schemas(),
    api.post(UNAVAILABILITIES, body, { idempotencyKey }),
  ]);
  return parseResponse(availabilitySchema, response);
}

export async function removeUnavailability(id: string): Promise<Availability> {
  const [{ availabilitySchema }, response] = await Promise.all([
    schemas(),
    api.delete(unavailabilityPath(id)),
  ]);
  return parseResponse(availabilitySchema, response);
}

/** Mon activité (`GET /me/activity`) : heures et séances par semaine et par mois, sans montants. */
export async function getMyActivity(signal?: AbortSignal): Promise<Activity> {
  const [{ activitySchema }, body] = await Promise.all([schemas(), api.get(ACTIVITY, { signal })]);
  return parseResponse(activitySchema, body);
}
