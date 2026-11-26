import type { OutboxEntry } from '@/lib/offline/outbox';
import type { AgentSession, AgentVisit } from '@/features/cleaning/field-schemas';

/**
 * Les 14 actions de terrain du Nettoyage (R-EX-05), gardées dans la file d'attente puis rejouées dans
 * l'ordre : 6 pour la visite des lieux, 8 pour la séance. Le corps est figé au geste ; les photos sont
 * déposées au service file juste avant l'envoi, et leur identifiant complète le corps.
 */

export const VISIT_ACTIONS = [
  'visit.arrive',
  'visit.observations',
  'visit.photo',
  'visit.photo.remove',
  'visit.complete',
  'visit.missed',
] as const;

export const SESSION_ACTIONS = [
  'session.arrive',
  'session.photo',
  'session.photo.remove',
  'session.start',
  'session.checklist',
  'session.incident',
  'session.complete',
  'session.missed',
] as const;

export type VisitActionType = (typeof VISIT_ACTIONS)[number];
export type SessionActionType = (typeof SESSION_ACTIONS)[number];
export type FieldActionType = VisitActionType | SessionActionType;
export type TargetKind = 'visit' | 'session';
export type FieldView = AgentVisit | AgentSession;

/** Groupe de la file : une visite ou une séance (ordre strict de l'envoi). */
export const groupOf = (kind: TargetKind, id: string) => `${kind}:${id}`;

export function parseGroup(group: string): { kind: TargetKind; id: string } {
  const [kind, ...rest] = group.split(':');
  return { kind: kind === 'visit' ? 'visit' : 'session', id: rest.join(':') };
}

/** Corps envoyé : le corps figé, complété par les identifiants des photos déposées. */
export function requestBody(entry: Pick<OutboxEntry, 'body' | 'files'>): Record<string, unknown> {
  const body: Record<string, unknown> = { ...entry.body };
  for (const file of entry.files) {
    if (!file.fileId) continue;
    if (file.field === 'photoFileIds') {
      const list = Array.isArray(body.photoFileIds) ? (body.photoFileIds as string[]) : [];
      body.photoFileIds = [...list, file.fileId];
    } else {
      body[file.field] = file.fileId;
    }
  }
  return body;
}

type Tick = { code: string; checked: boolean; cleaningTypeCode?: string };

function sameValues(a: Record<string, unknown> | null, b: unknown): boolean {
  if (!a || !b || typeof b !== 'object') return false;
  const left = Object.entries(a).filter(([, value]) => value !== undefined);
  const right = Object.entries(b as Record<string, unknown>).filter(([, value]) => value !== undefined);
  return (
    left.length === right.length &&
    left.every(([key, value]) => (b as Record<string, unknown>)[key] === value)
  );
}

/**
 * Après un refus `CLEANING_INVALID_TRANSITION` au rejeu, la fiche relue dit si l'action est déjà faite
 * (par un autre envoi, ou par le superviseur) : elle sort alors de la file sans erreur.
 */
export function alreadyDone(
  entry: Pick<OutboxEntry, 'type' | 'body' | 'files' | 'ref'>,
  view: FieldView,
): boolean {
  const body = requestBody(entry);
  const photos = view.photos;
  switch (entry.type as FieldActionType) {
    case 'visit.arrive':
    case 'session.arrive':
      return view.arrival !== null;
    case 'visit.observations':
      return sameValues((view as AgentVisit).observedValues, body.values);
    case 'visit.photo':
    case 'session.photo':
      return typeof body.fileId === 'string' && photos.some((photo) => photo.fileId === body.fileId);
    case 'visit.photo.remove':
    case 'session.photo.remove':
      return !photos.some((photo) => photo.fileId === entry.ref);
    case 'visit.complete':
    case 'session.complete':
      return view.status === 'completed';
    case 'visit.missed':
    case 'session.missed':
      return view.status === 'missed';
    case 'session.start':
      return (view as AgentSession).startedAt !== null;
    case 'session.checklist': {
      const items = (Array.isArray(body.items) ? body.items : []) as Tick[];
      const checklist = (view as AgentSession).checklist;
      return items.every((tick) =>
        checklist.some(
          (item) =>
            item.code === tick.code &&
            (item.cleaningTypeCode ?? null) === (tick.cleaningTypeCode ?? null) &&
            item.checked === tick.checked,
        ),
      );
    }
    case 'session.incident':
      return (view as AgentSession).incidents.some(
        (incident) => incident.category === body.category && incident.note === body.note,
      );
    default:
      return false;
  }
}
