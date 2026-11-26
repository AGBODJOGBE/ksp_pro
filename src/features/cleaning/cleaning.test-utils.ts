import type { ApplicationDraft } from './application/draft';
import { newDraft } from './application/draft';
import { emptyWeek } from './weekly';

/** Réponses du Nettoyage au format du contrat `ksp-api.v1.yaml`, pour les tests des écrans. */

const photo = (id: string) => ({ id, name: `${id}.jpg`, uploadedAt: Date.now() });

/** Brouillon complet, prêt pour le récapitulatif. */
export function completeDraft(overrides: Partial<ApplicationDraft> = {}): ApplicationDraft {
  return {
    ...newDraft({ firstName: 'Koffi', lastName: 'Adjovi' }),
    photo: photo('0192f1c4-7a2b-7c3d-8e4f-5a6b7c8df001'),
    idFront: photo('0192f1c4-7a2b-7c3d-8e4f-5a6b7c8df002'),
    idBack: photo('0192f1c4-7a2b-7c3d-8e4f-5a6b7c8df003'),
    residenceCommuneKey: 'cotonou',
    zoneKeys: ['cotonou', 'abomey-calavi'],
    skillCodes: ['interior_cleaning'],
    weekly: { ...emptyWeek(), mon: [{ start: '08:00', end: '17:00' }] },
    emergencyName: 'Afi Adjovi',
    emergencyPhone: '01 97 00 00 46',
    employmentKind: 'independent',
    mobileMoney: '',
    ...overrides,
  };
}

export const STATS = {
  sessionsCompleted: 14,
  visitsCompleted: 6,
  hoursThisWeek: 12.5,
  hoursThisMonth: 46,
  ratingAverage: 4.6,
  ratingsCount: 9,
  openClaims: 0,
};

export function agentBody(status = 'active', employmentKind = 'independent') {
  return {
    id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e30',
    userId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
    status,
    firstName: 'Koffi',
    lastName: 'Adjovi',
    phone: '+2290197000045',
    photoUrl: null,
    employmentKind,
    residenceCommuneKey: 'cotonou',
    zoneKeys: ['cotonou', 'abomey-calavi'],
    skills: [
      { code: 'interior_cleaning', name: 'Nettoyage intérieur', validated: true },
      { code: 'gardening', name: 'Jardinage', validated: false },
    ],
    maxHoursPerDay: 8,
    maxHoursPerWeek: 40,
    emergencyContact: { name: 'Afi Adjovi', phone: '+2290197000046' },
    mobileMoneyNumber: null,
    hasIdDocument: true,
    stats: STATS,
    createdAt: '2026-11-20T09:00:00Z',
    updatedAt: '2026-11-21T09:00:00Z',
  };
}

export const ZONES = {
  data: [
    { communeKey: 'abomey-calavi', name: 'Abomey-Calavi' },
    { communeKey: 'cotonou', name: 'Cotonou' },
  ],
};

export const SKILLS = {
  data: [
    { id: 's1', code: 'interior_cleaning', name: 'Nettoyage intérieur', active: true },
    { id: 's2', code: 'gardening', name: 'Jardinage', active: true },
    { id: 's3', code: 'pool', name: 'Piscine', active: false },
  ],
  nextCursor: null,
  total: 3,
};

export function assignmentBody(overrides: Record<string, unknown> = {}) {
  return {
    assignmentId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8da001',
    target: { kind: 'session', id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8db001' },
    status: 'confirmed',
    isLead: false,
    start: '2026-11-26T09:00:00Z',
    end: '2026-11-26T11:00:00Z',
    targetStatus: 'assigned',
    placeTypeName: 'Villa',
    communeName: 'Cotonou',
    respondBefore: null,
    ...overrides,
  };
}

export const list = <T>(data: T[], nextCursor: string | null = null) => ({
  data,
  nextCursor,
  total: data.length,
});

export function availabilityBody(overrides: Record<string, unknown> = {}) {
  return {
    weekly: [{ weekday: 'mon', ranges: [{ start: '08:00', end: '17:00' }] }],
    extraAvailabilities: [],
    unavailabilities: [
      {
        id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8dd001',
        start: '2026-12-21T23:00:00Z',
        end: '2026-12-26T23:00:00Z',
        kind: 'leave',
        note: 'Fêtes de fin d’année',
        forced: false,
        createdBy: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
        createdAt: '2026-11-20T09:00:00Z',
        createdByName: 'Koffi Adjovi',
      },
    ],
    maxHoursPerDay: 8,
    maxHoursPerWeek: 40,
    ...overrides,
  };
}

export const ACTIVITY = {
  stats: STATS,
  weeks: [
    { periodStart: '2026-11-23', hours: 12.5, sessionsCompleted: 4 },
    { periodStart: '2026-11-16', hours: 18, sessionsCompleted: 6 },
  ],
  months: [{ periodStart: '2026-11-01', hours: 46, sessionsCompleted: 14 }],
};
