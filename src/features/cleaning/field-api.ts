'use client';

import { api, parseResponse } from '@/lib/api';
import type { AgentSession, AgentVisit } from './field-schemas';

/**
 * Appels de terrain de l'agent du Nettoyage : fiches (`GET /cleaning/agent/visits|sessions/{id}`) et les 14
 * actions rejouables hors connexion (R-EX-05), toutes avec leur clé d'idempotence et, sauf le retrait d'une
 * photo, l'heure réelle du geste (`occurredAt`). Chaque action renvoie la fiche à jour. Les corps arrivent
 * figés de la file d'attente (`field/outbox`) : ils partent tels quels. Sans montants (R-EX-04).
 */

const agentVisit = (id: string) => `/api/v1/cleaning/agent/visits/${encodeURIComponent(id)}`;
const agentSession = (id: string) => `/api/v1/cleaning/agent/sessions/${encodeURIComponent(id)}`;
const visit = (id: string) => `/api/v1/cleaning/visits/${encodeURIComponent(id)}`;
const session = (id: string) => `/api/v1/cleaning/sessions/${encodeURIComponent(id)}`;

type Body = Record<string, unknown>;

const schemas = () => import('./field-schemas');

async function visitView(request: Promise<unknown>): Promise<AgentVisit> {
  const [{ agentVisitSchema }, body] = await Promise.all([schemas(), request]);
  return parseResponse(agentVisitSchema, body);
}

async function sessionView(request: Promise<unknown>): Promise<AgentSession> {
  const [{ agentSessionSchema }, body] = await Promise.all([schemas(), request]);
  return parseResponse(agentSessionSchema, body);
}

export function getAgentVisit(id: string, signal?: AbortSignal): Promise<AgentVisit> {
  return visitView(api.get(agentVisit(id), { signal }));
}

export function getAgentSession(id: string, signal?: AbortSignal): Promise<AgentSession> {
  return sessionView(api.get(agentSession(id), { signal }));
}

/* ——— Visite des lieux (permission `cleaning.visit.perform`) ——— */

export function arriveAtVisit(id: string, body: Body, idempotencyKey: string) {
  return visitView(api.post(`${visit(id)}/arrive`, body, { idempotencyKey }));
}

export function saveVisitObservations(id: string, body: Body, idempotencyKey: string) {
  return visitView(api.put(`${visit(id)}/observations`, body, { idempotencyKey }));
}

export function addVisitPhoto(id: string, body: Body, idempotencyKey: string) {
  return visitView(api.post(`${visit(id)}/photos`, body, { idempotencyKey }));
}

export function removeVisitPhoto(id: string, fileId: string, idempotencyKey: string) {
  return visitView(api.delete(`${visit(id)}/photos/${encodeURIComponent(fileId)}`, { idempotencyKey }));
}

export function completeVisit(id: string, body: Body, idempotencyKey: string) {
  return visitView(api.post(`${visit(id)}/complete`, body, { idempotencyKey }));
}

export function reportVisitMissed(id: string, body: Body, idempotencyKey: string) {
  return visitView(api.post(`${visit(id)}/missed`, body, { idempotencyKey }));
}

/* ——— Séance (permission `cleaning.session.perform`) ——— */

export function arriveAtSession(id: string, body: Body, idempotencyKey: string) {
  return sessionView(api.post(`${session(id)}/arrive`, body, { idempotencyKey }));
}

export function addSessionPhoto(id: string, body: Body, idempotencyKey: string) {
  return sessionView(api.post(`${session(id)}/photos`, body, { idempotencyKey }));
}

export function removeSessionPhoto(id: string, fileId: string, idempotencyKey: string) {
  return sessionView(api.delete(`${session(id)}/photos/${encodeURIComponent(fileId)}`, { idempotencyKey }));
}

export function startSession(id: string, body: Body, idempotencyKey: string) {
  return sessionView(api.post(`${session(id)}/start`, body, { idempotencyKey }));
}

export function updateSessionChecklist(id: string, body: Body, idempotencyKey: string) {
  return sessionView(api.patch(`${session(id)}/checklist`, body, { idempotencyKey }));
}

export function reportSessionIncident(id: string, body: Body, idempotencyKey: string) {
  return sessionView(api.post(`${session(id)}/incident`, body, { idempotencyKey }));
}

export function completeSession(id: string, body: Body, idempotencyKey: string) {
  return sessionView(api.post(`${session(id)}/complete`, body, { idempotencyKey }));
}

export function reportSessionMissed(id: string, body: Body, idempotencyKey: string) {
  return sessionView(api.post(`${session(id)}/missed`, body, { idempotencyKey }));
}
