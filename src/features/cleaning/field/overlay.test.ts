import type { OutboxEntry } from '@/lib/offline/outbox';
import { ARRIVAL, photoBody, sessionViewBody, visitBody } from '@/features/cleaning/cleaning.test-utils';
import type { AgentSession, AgentVisit, VisitParameter } from '@/features/cleaning/field-schemas';
import { displayValue, initialForm, readForm } from './observations';
import { markKey, overlaySession, overlayVisit } from './overlay';

let id = 0;
function entry(type: string, body: Record<string, unknown>, extra: Partial<OutboxEntry> = {}): OutboxEntry {
  id += 1;
  return {
    id,
    userId: 'u1',
    group: 'x',
    type,
    body,
    key: `cle-${id}0000000`,
    occurredAt: Date.parse(String(body.occurredAt ?? '2026-11-26T09:10:00Z')),
    files: [],
    status: 'pending',
    error: null,
    attempts: 0,
    ...extra,
  };
}

const visit = (overrides: Record<string, unknown> = {}) => visitBody(overrides) as unknown as AgentVisit;
const session = (overrides: Record<string, unknown> = {}) =>
  sessionViewBody(overrides) as unknown as AgentSession;
const photo = new Blob(['jpeg'], { type: 'image/jpeg' });

describe('fiche affichée hors connexion', () => {
  it('visite : arrivée, constat et photo s’affichent faits, en attente d’envoi', () => {
    const arrive = entry('visit.arrive', { accuracyMeters: 12, occurredAt: '2026-11-26T08:58:00.000Z' });
    const observations = entry('visit.observations', {
      values: { superficie: 140 },
      note: 'Fuite',
      occurredAt: '2026-11-26T09:10:00.000Z',
    });
    const added = entry(
      'visit.photo',
      { occurredAt: '2026-11-26T09:12:00.000Z' },
      {
        files: [{ field: 'fileId', blob: photo, name: 'a.jpg' }],
      },
    );
    const { view, marks, local, sources } = overlayVisit(
      visit(),
      [arrive, observations, added],
      observations.id,
    );

    expect(view.status).toBe('in_progress');
    expect(view.arrival).toMatchObject({ arrivedAt: '2026-11-26T08:58:00.000Z', arrivalAccuracyMeters: 12 });
    expect(view.observedValues).toEqual({ superficie: 140 });
    expect(view.note).toBe('Fuite');
    const localId = `local-${added.id}-0`;
    expect(view.photos.map((item) => item.fileId)).toEqual([localId]);
    expect(local[localId]).toBe(photo);
    expect(sources[localId]).toBe(added.id);
    expect(marks).toMatchObject({
      arrival: 'pending',
      observations: 'sending',
      [markKey.photo(localId)]: 'pending',
    });
    // Jamais de position inventée : elle n'arrive qu'avec la fiche de la gateway.
    expect(view.place.location).toBeNull();
  });

  it('visite : une photo retirée disparaît, une fin refusée reste marquée', () => {
    const removed = entry('visit.photo.remove', {}, { ref: 'f1' });
    const complete = entry('visit.complete', { occurredAt: '2026-11-26T09:40:00.000Z' }, { status: 'error' });
    const { view, marks } = overlayVisit(
      visit({
        status: 'in_progress',
        arrival: ARRIVAL,
        photos: [photoBody('f1', 'visit'), photoBody('f2', 'visit')],
      }),
      [removed, complete],
    );
    expect(view.photos.map((item) => item.fileId)).toEqual(['f2']);
    expect(view.status).toBe('completed');
    expect(marks.complete).toBe('error');
  });

  it('séance : arrivée, photo « avant », démarrage, case cochée, incident', () => {
    const entries = [
      entry('session.arrive', { occurredAt: '2026-11-26T08:50:00.000Z' }),
      entry(
        'session.photo',
        { kind: 'before', occurredAt: '2026-11-26T08:52:00.000Z' },
        {
          files: [{ field: 'fileId', blob: photo, name: 'a.jpg', fileId: 'f7', uploadedAt: 1 }],
        },
      ),
      entry('session.start', { occurredAt: '2026-11-26T09:00:00.000Z' }),
      entry('session.checklist', {
        items: [{ code: 'sol_balayage', checked: true, cleaningTypeCode: 'sol' }],
        occurredAt: '2026-11-26T09:20:00.000Z',
      }),
      entry('session.incident', {
        category: 'equipment',
        note: 'Panne',
        occurredAt: '2026-11-26T09:30:00.000Z',
      }),
    ];
    const { view, marks } = overlaySession(session(), entries);

    expect(view.arrival?.arrivedAt).toBe('2026-11-26T08:50:00.000Z');
    expect(view.photos).toEqual([expect.objectContaining({ fileId: 'f7', kind: 'before' })]);
    expect(view.startedAt).toBe('2026-11-26T09:00:00.000Z');
    expect(view.checklist.find((item) => item.code === 'sol_balayage')).toMatchObject({
      checked: true,
      checkedAt: '2026-11-26T09:20:00.000Z',
    });
    expect(view.status).toBe('interrupted');
    expect(view.incidents).toEqual([
      expect.objectContaining({ category: 'equipment', note: 'Panne', decision: 'pending' }),
    ]);
    expect(marks[markKey.check('sol_balayage', 'sol')]).toBe('pending');
    expect(marks.start).toBe('pending');
  });
});

describe('formulaire du constat', () => {
  const parameters = visitBody().parameters as VisitParameter[];

  it('prérempli avec le déclaré ; paramètre et choix désactivés écartés', () => {
    expect(initialForm(parameters, visitBody().declaredValues)).toEqual({
      superficie: '120',
      etat: '',
      animaux: 'false',
    });
  });

  it('valeurs envoyées : entiers dans les bornes, choix proposés, oui/non', () => {
    expect(readForm(parameters, { superficie: '140', etat: 'sale', animaux: 'true' })).toEqual({
      values: { superficie: 140, etat: 'sale', animaux: true },
      errors: {},
    });
  });

  it('erreurs près du champ : obligatoire, nombre entier, bornes', () => {
    expect(readForm(parameters, { superficie: '12,5', etat: '', animaux: '' }).errors).toEqual({
      superficie: 'Entrez un nombre entier.',
      etat: 'Renseignez cette valeur.',
    });
    expect(readForm(parameters, { superficie: '5', etat: 'propre' }).errors).toEqual({
      superficie: 'Entre 10 et 2000.',
    });
  });

  it('valeur lisible du constat enregistré', () => {
    const [area, state, pets] = parameters;
    expect(displayValue(area!, 140)).toBe('140 m²');
    expect(displayValue(state!, 'sale')).toBe('Sale');
    expect(displayValue(pets!, false)).toBe('Non');
    expect(displayValue(pets!, undefined)).toBe('Non renseigné');
  });
});
