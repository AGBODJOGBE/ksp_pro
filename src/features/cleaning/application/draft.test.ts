import { DRAFT_KEY, clearDraft, newDraft, readDraft, saveDraft } from './draft';

const PROFILE = { firstName: 'Koffi', lastName: 'Adjovi' };
const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = Date.parse('2026-11-26T09:00:00Z');

beforeEach(() => localStorage.clear());

describe('brouillon de la candidature', () => {
  it('commence avec le prénom et le nom du profil', () => {
    expect(newDraft(PROFILE)).toMatchObject({
      step: 0,
      firstName: 'Koffi',
      lastName: 'Adjovi',
      zoneKeys: [],
    });
    expect(newDraft({ firstName: null, lastName: null }).firstName).toBe('');
  });

  it('est gardé sur l’appareil et relu par le même compte', () => {
    const draft = {
      ...newDraft(PROFILE),
      step: 4,
      zoneKeys: ['cotonou'],
      employmentKind: 'employee' as const,
    };
    expect(saveDraft('u1', draft, NOW)).toBe(true);
    expect(localStorage.getItem(DRAFT_KEY)).toContain('cotonou');

    const restored = readDraft('u1', PROFILE, NOW + HOUR);
    expect(restored?.draft).toEqual(draft);
    expect(restored?.filesExpired).toBe(false);
  });

  it('n’est jamais lu par un autre compte', () => {
    saveDraft('u1', newDraft(PROFILE), NOW);
    expect(readDraft('u2', PROFILE, NOW)).toBeNull();
  });

  it('expire 7 jours après la dernière modification', () => {
    saveDraft('u1', newDraft(PROFILE), NOW);
    expect(readDraft('u1', PROFILE, NOW + 7 * DAY - 1)).not.toBeNull();
    saveDraft('u1', newDraft(PROFILE), NOW + 3 * DAY);
    expect(readDraft('u1', PROFILE, NOW + 9 * DAY)).not.toBeNull();
    expect(readDraft('u1', PROFILE, NOW + 10 * DAY)).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('retire une photo déposée il y a plus de 23 heures (purgée par le service file)', () => {
    const draft = {
      ...newDraft(PROFILE),
      photo: { id: 'f1', name: 'moi.jpg', uploadedAt: NOW },
      idFront: { id: 'f2', name: 'recto.jpg', uploadedAt: NOW + 2 * HOUR },
    };
    saveDraft('u1', draft, NOW);

    const restored = readDraft('u1', PROFILE, NOW + 24 * HOUR);
    expect(restored?.filesExpired).toBe(true);
    expect(restored?.draft.photo).toBeNull();
    expect(restored?.draft.idFront).toEqual({ id: 'f2', name: 'recto.jpg', uploadedAt: NOW + 2 * HOUR });
  });

  it('relit champ par champ un brouillon abîmé', () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        value: {
          userId: 'u1',
          draft: {
            step: -2,
            firstName: 4,
            zoneKeys: ['cotonou', 7],
            weekly: { mon: [{ start: '08:00' }] },
            employmentKind: 'x',
          },
        },
        expiresAt: NOW + DAY,
      }),
    );
    const restored = readDraft('u1', PROFILE, NOW);
    expect(restored?.draft).toMatchObject({
      step: 0,
      firstName: 'Koffi',
      zoneKeys: ['cotonou'],
      employmentKind: '',
    });
    expect(restored?.draft.weekly.mon).toEqual([]);
  });

  it('est effacé après l’envoi', () => {
    saveDraft('u1', newDraft(PROFILE), NOW);
    clearDraft();
    expect(readDraft('u1', PROFILE, NOW)).toBeNull();
  });
});
