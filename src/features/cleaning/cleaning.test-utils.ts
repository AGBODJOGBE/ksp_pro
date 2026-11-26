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

/* ——— Terrain : fiches de visite et de séance (`CleaningAgentVisitView`, `CleaningAgentSessionView`) ——— */

export const VISIT_ID = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8db002';
export const SESSION_ID = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8db001';

const place = (location: boolean) => ({
  name: 'Villa Les Palmiers',
  placeTypeName: 'Villa',
  communeName: 'Abomey-Calavi',
  location: location
    ? {
        latitude: 6.4485,
        longitude: 2.3557,
        landmark: 'Portail bleu après la pharmacie',
        address: 'Rue 12, Tankpè',
        readableAddress: null,
        accuracyMeters: 15,
      }
    : null,
  customerFirstName: 'Afi',
});

export function visitBody(overrides: Record<string, unknown> = {}) {
  const status = (overrides.status as string | undefined) ?? 'scheduled';
  return {
    id: VISIT_ID,
    requestNumber: 'NET-2026-00042',
    status,
    scheduledAt: '2026-11-26T09:00:00Z',
    durationMinutes: 60,
    isLead: true,
    place: place(status === 'in_progress'),
    cleaningTypes: [{ id: 't1', code: 'sol', name: 'Sols' }],
    parameters: [
      {
        id: 'p1',
        code: 'superficie',
        label: 'Superficie',
        kind: 'number',
        unit: 'm²',
        min: 10,
        max: 2000,
        choices: [],
        required: true,
        help: null,
        active: true,
      },
      {
        id: 'p2',
        code: 'etat',
        label: 'État général',
        kind: 'choice',
        unit: null,
        min: null,
        max: null,
        choices: [
          { code: 'propre', label: 'Propre', active: true },
          { code: 'sale', label: 'Sale', active: true },
          { code: 'tres_sale', label: 'Très sale', active: false },
        ],
        required: true,
        help: 'Votre impression en entrant.',
        active: true,
      },
      {
        id: 'p3',
        code: 'animaux',
        label: 'Animaux présents',
        kind: 'boolean',
        unit: null,
        min: null,
        max: null,
        choices: [],
        required: false,
        help: null,
        active: true,
      },
      {
        id: 'p4',
        code: 'ancien',
        label: 'Paramètre retiré',
        kind: 'number',
        unit: null,
        min: null,
        max: null,
        choices: [],
        required: true,
        help: null,
        active: false,
      },
    ],
    declaredValues: { superficie: 120, etat: 'tres_sale', animaux: false },
    observedValues: null,
    photos: [],
    arrival: null,
    completedAt: null,
    note: null,
    ...overrides,
  };
}

export const ARRIVAL = {
  arrivedAt: '2026-11-26T08:58:00Z',
  distanceMeters: 40,
  alert: false,
  placeAccuracyMeters: 15,
  arrivalAccuracyMeters: 12,
  uncertain: false,
};

export function photoBody(fileId: string, kind: string) {
  return {
    fileId,
    kind,
    takenAt: '2026-11-26T09:05:00Z',
    url: `https://stockage.test/ksp-files/${fileId}?X-Amz-Signature=lecture`,
    urlExpiresAt: '2026-11-26T10:05:00Z',
  };
}

export function sessionViewBody(overrides: Record<string, unknown> = {}) {
  const status = (overrides.status as string | undefined) ?? 'assigned';
  return {
    id: SESSION_ID,
    programNumber: 'PRG-2026-0007',
    rank: 3,
    status,
    scheduledStart: '2026-11-26T09:00:00Z',
    scheduledEnd: '2026-11-26T12:00:00Z',
    isLead: true,
    team: [
      {
        agentId: 'a1',
        firstName: 'Koffi',
        lastName: 'Adjovi',
        photoUrl: null,
        isLead: true,
        confirmation: 'confirmed',
      },
      {
        agentId: 'a2',
        firstName: 'Rachidi',
        lastName: 'Sanni',
        photoUrl: null,
        isLead: false,
        confirmation: 'confirmed',
      },
    ],
    place: place(status === 'in_progress'),
    checklist: [
      { code: 'arrival', label: 'Matériel déballé', cleaningTypeCode: null, checked: false, checkedAt: null },
      {
        code: 'sol_balayage',
        label: 'Sols balayés',
        cleaningTypeCode: 'sol',
        checked: false,
        checkedAt: null,
      },
    ],
    photos: [],
    incidents: [],
    arrival: null,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

export const STORED_FILE = (id: string, status = 'available') => ({
  id,
  purpose: 'cleaning_intervention_photo',
  fileName: 'photo.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 4,
  status,
  rejectionReason: null,
  subject: null,
  createdAt: '2026-11-26T09:00:00Z',
  completedAt: status === 'available' ? '2026-11-26T09:00:01Z' : null,
});

/** Routes du dépôt d'une photo (`f1`, `f2`…) : déclaration, stockage, confirmation. */
export function uploadRoutes(ids: string[]) {
  return {
    'POST /api/v1/file/uploads': ids.map((id) => ({
      status: 200,
      body: {
        file: STORED_FILE(id, 'pending'),
        upload: {
          url: `https://stockage.test/ksp-files/${id}?X-Amz-Signature=abc`,
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          expiresAt: '2026-11-26T09:15:00Z',
        },
      },
    })),
    ...Object.fromEntries(ids.map((id) => [`PUT /ksp-files/${id}`, { status: 200, body: {} }])),
    ...Object.fromEntries(
      ids.map((id) => [`POST /api/v1/file/files/${id}/complete`, { status: 200, body: STORED_FILE(id) }]),
    ),
  };
}
