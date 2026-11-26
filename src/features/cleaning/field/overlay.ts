import type { OutboxEntry } from '@/lib/offline/outbox';
import type { AgentSession, AgentVisit, FieldIncident, FieldPhoto } from '@/features/cleaning/field-schemas';
import type { FieldActionType } from './actions';

/**
 * Fiche affichée = fiche de la gateway + gestes encore dans la file (hors connexion, envoi en cours ou
 * refusé). Chaque geste s'affiche tout de suite comme fait ; `marks` dit lesquels attendent leur envoi
 * (`pending`, `sending`) ou ont été refusés (`error`). Aucune règle métier : seuls les champs que le
 * geste change sont recopiés (statut attendu, heure du geste, photo locale).
 */

export type Mark = 'pending' | 'sending' | 'error';

export interface Overlay<V> {
  view: V;
  marks: Record<string, Mark>;
  /** Photos encore sur le téléphone : identifiant affiché → contenu (aperçu local). */
  local: Record<string, Blob>;
  /** Photo ajoutée encore dans la file : identifiant affiché → action qui l'ajoute (retrait sans envoi). */
  sources: Record<string, number>;
}

/** Clés de `marks`. */
export const markKey = {
  photo: (fileId: string) => `photo:${fileId}`,
  check: (code: string, cleaningTypeCode: string | null) => `check:${cleaningTypeCode ?? ''}:${code}`,
  incident: (id: string) => `incident:${id}`,
};

const iso = (at: number) => new Date(at).toISOString();

function markOf(entry: OutboxEntry, inFlight: number | null): Mark {
  if (entry.status === 'error') return 'error';
  return entry.id === inFlight ? 'sending' : 'pending';
}

/** Photo ajoutée par le geste : identifiant du service file s'il est déjà déposé, sinon local. */
function addedPhotos(entry: OutboxEntry, kind: string): Array<{ photo: FieldPhoto; blob: Blob }> {
  return entry.files.map((file, index) => ({
    photo: {
      fileId: file.fileId ?? `local-${entry.id}-${index}`,
      kind,
      takenAt: iso(entry.occurredAt),
      url: null,
      urlExpiresAt: null,
    },
    blob: file.blob,
  }));
}

function arrivalOf(entry: OutboxEntry) {
  const accuracy = entry.body.accuracyMeters;
  return {
    arrivedAt: iso(entry.occurredAt),
    distanceMeters: null,
    alert: false,
    placeAccuracyMeters: null,
    arrivalAccuracyMeters: typeof accuracy === 'number' ? accuracy : null,
    uncertain: false,
  };
}

export function overlayVisit(
  view: AgentVisit,
  entries: OutboxEntry[],
  inFlight: number | null = null,
): Overlay<AgentVisit> {
  const marks: Record<string, Mark> = {};
  const local: Record<string, Blob> = {};
  const sources: Record<string, number> = {};
  let next: AgentVisit = { ...view, photos: [...view.photos] };
  for (const entry of entries) {
    const mark = markOf(entry, inFlight);
    const body = entry.body;
    switch (entry.type as FieldActionType) {
      case 'visit.arrive':
        if (!next.arrival) next = { ...next, arrival: arrivalOf(entry) };
        if (next.status === 'scheduled') next.status = 'in_progress';
        marks.arrival = mark;
        break;
      case 'visit.observations':
        next = {
          ...next,
          observedValues: (body.values ?? {}) as AgentVisit['declaredValues'],
          note: typeof body.note === 'string' ? body.note : null,
        };
        marks.observations = mark;
        break;
      case 'visit.photo':
        for (const { photo, blob } of addedPhotos(entry, 'visit')) {
          if (!next.photos.some((item) => item.fileId === photo.fileId)) next.photos.push(photo);
          local[photo.fileId] = blob;
          sources[photo.fileId] = entry.id;
          marks[markKey.photo(photo.fileId)] = mark;
        }
        break;
      case 'visit.photo.remove':
        next.photos = next.photos.filter((photo) => photo.fileId !== entry.ref);
        break;
      case 'visit.complete':
        next = { ...next, status: 'completed', completedAt: iso(entry.occurredAt) };
        marks.complete = mark;
        break;
      case 'visit.missed':
        next = { ...next, status: 'missed' };
        marks.missed = mark;
        break;
    }
  }
  return { view: next, marks, local, sources };
}

export function overlaySession(
  view: AgentSession,
  entries: OutboxEntry[],
  inFlight: number | null = null,
): Overlay<AgentSession> {
  const marks: Record<string, Mark> = {};
  const local: Record<string, Blob> = {};
  const sources: Record<string, number> = {};
  let next: AgentSession = {
    ...view,
    photos: [...view.photos],
    checklist: view.checklist.map((item) => ({ ...item })),
    incidents: [...view.incidents],
  };
  for (const entry of entries) {
    const mark = markOf(entry, inFlight);
    const body = entry.body;
    switch (entry.type as FieldActionType) {
      case 'session.arrive':
        if (!next.arrival) next = { ...next, arrival: arrivalOf(entry) };
        marks.arrival = mark;
        break;
      case 'session.photo':
        for (const { photo, blob } of addedPhotos(entry, String(body.kind))) {
          if (!next.photos.some((item) => item.fileId === photo.fileId)) next.photos.push(photo);
          local[photo.fileId] = blob;
          sources[photo.fileId] = entry.id;
          marks[markKey.photo(photo.fileId)] = mark;
        }
        break;
      case 'session.photo.remove':
        next.photos = next.photos.filter((photo) => photo.fileId !== entry.ref);
        break;
      case 'session.start':
        next = { ...next, status: 'in_progress', startedAt: next.startedAt ?? iso(entry.occurredAt) };
        marks.start = mark;
        break;
      case 'session.checklist':
        for (const tick of (Array.isArray(body.items) ? body.items : []) as Array<{
          code: string;
          checked: boolean;
          cleaningTypeCode?: string;
        }>) {
          const item = next.checklist.find(
            (point) =>
              point.code === tick.code &&
              (point.cleaningTypeCode ?? null) === (tick.cleaningTypeCode ?? null),
          );
          if (!item) continue;
          item.checked = tick.checked;
          item.checkedAt = tick.checked ? iso(entry.occurredAt) : null;
          marks[markKey.check(item.code, item.cleaningTypeCode)] = mark;
        }
        break;
      case 'session.incident': {
        const id = `local-${entry.id}`;
        const photos = addedPhotos(entry, 'incident');
        photos.forEach(({ photo, blob }) => {
          local[photo.fileId] = blob;
        });
        const incident: FieldIncident = {
          id,
          category: String(body.category),
          note: String(body.note ?? ''),
          photos: photos.map(({ photo }) => photo),
          reportedAt: iso(entry.occurredAt),
          decision: 'pending',
          decidedAt: null,
        };
        next = { ...next, status: 'interrupted', incidents: [...next.incidents, incident] };
        marks[markKey.incident(id)] = mark;
        break;
      }
      case 'session.complete':
        next = { ...next, status: 'completed', completedAt: iso(entry.occurredAt) };
        marks.complete = mark;
        break;
      case 'session.missed':
        next = { ...next, status: 'missed' };
        marks.missed = mark;
        break;
    }
  }
  return { view: next, marks, local, sources };
}
