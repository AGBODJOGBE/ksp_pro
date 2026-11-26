import type { PhotoValue } from '@/features/file';
import { readStored, removeStored, writeStored } from '@/lib/device-storage';
import { emptyWeek, WEEKDAYS, type WeeklyPlan } from '@/features/cleaning/weekly';

/**
 * Brouillon de la candidature, gardé sur l'appareil (`localStorage`) 7 jours après la dernière
 * modification et rattaché au compte : un autre compte ne le lit pas (et `lib/api/account-data` l'efface
 * quand un autre compte se connecte, ou à la déconnexion). La candidature peut ainsi être reprise dans
 * l'application installée.
 *
 * Les photos ne sont gardées que par leur identifiant : le service file efface un fichier jamais rattaché
 * après 24 heures. Passé 23 heures, la photo est retirée du brouillon et redemandée.
 */

export const DRAFT_KEY = 'ksp.pro.candidature';
export const DRAFT_DAYS = 7;
/** Fichier déposé mais pas encore rattaché : purgé par le service file à 24 h (marge d'une heure). */
export const FILE_KEEP_MS = 23 * 3_600_000;

export type EmploymentKind = 'employee' | 'independent';

export interface ApplicationDraft {
  /** Étape en cours (rang). */
  step: number;
  firstName: string;
  lastName: string;
  photo: PhotoValue | null;
  idFront: PhotoValue | null;
  idBack: PhotoValue | null;
  residenceCommuneKey: string;
  zoneKeys: string[];
  skillCodes: string[];
  weekly: WeeklyPlan;
  emergencyName: string;
  emergencyPhone: string;
  employmentKind: EmploymentKind | '';
  mobileMoney: string;
}

interface StoredDraft {
  userId: string;
  draft: ApplicationDraft;
}

export function newDraft(profile: { firstName: string | null; lastName: string | null }): ApplicationDraft {
  return {
    step: 0,
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    photo: null,
    idFront: null,
    idBack: null,
    residenceCommuneKey: '',
    zoneKeys: [],
    skillCodes: [],
    weekly: emptyWeek(),
    emergencyName: '',
    emergencyPhone: '',
    employmentKind: '',
    mobileMoney: '',
  };
}

const text = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback);
const texts = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function photo(value: unknown, now: number): PhotoValue | null | 'expired' {
  const candidate = value as Partial<PhotoValue> | null;
  if (!candidate || typeof candidate.id !== 'string' || typeof candidate.uploadedAt !== 'number') return null;
  if (now - candidate.uploadedAt > FILE_KEEP_MS) return 'expired';
  return { id: candidate.id, name: text(candidate.name, 'photo'), uploadedAt: candidate.uploadedAt };
}

function week(value: unknown): WeeklyPlan {
  const plan = emptyWeek();
  if (!value || typeof value !== 'object') return plan;
  for (const day of WEEKDAYS) {
    const ranges = (value as Record<string, unknown>)[day];
    if (!Array.isArray(ranges)) continue;
    plan[day] = ranges
      .filter((range): range is { start: string; end: string } => {
        const item = range as { start?: unknown; end?: unknown } | null;
        return typeof item?.start === 'string' && typeof item.end === 'string';
      })
      .map(({ start, end }) => ({ start, end }));
  }
  return plan;
}

export interface RestoredDraft {
  draft: ApplicationDraft;
  /** Une photo trop ancienne a été retirée (purgée par le service file). */
  filesExpired: boolean;
}

/** Brouillon du compte, relu champ par champ (une valeur abîmée reprend sa valeur vide). */
export function readDraft(
  userId: string,
  profile: { firstName: string | null; lastName: string | null },
  now: number = Date.now(),
): RestoredDraft | null {
  const stored = readStored<StoredDraft>(DRAFT_KEY, now);
  if (!stored || stored.userId !== userId || !stored.draft || typeof stored.draft !== 'object') return null;
  const raw = stored.draft as Partial<ApplicationDraft>;
  const base = newDraft(profile);
  const photos = {
    photo: photo(raw.photo, now),
    idFront: photo(raw.idFront, now),
    idBack: photo(raw.idBack, now),
  };
  const filesExpired = Object.values(photos).includes('expired');
  const kept = (value: PhotoValue | null | 'expired') => (value === 'expired' ? null : value);
  const employment =
    raw.employmentKind === 'employee' || raw.employmentKind === 'independent' ? raw.employmentKind : '';
  return {
    filesExpired,
    draft: {
      step: typeof raw.step === 'number' && Number.isInteger(raw.step) && raw.step >= 0 ? raw.step : 0,
      firstName: text(raw.firstName, base.firstName),
      lastName: text(raw.lastName, base.lastName),
      photo: kept(photos.photo),
      idFront: kept(photos.idFront),
      idBack: kept(photos.idBack),
      residenceCommuneKey: text(raw.residenceCommuneKey, ''),
      zoneKeys: texts(raw.zoneKeys),
      skillCodes: texts(raw.skillCodes),
      weekly: week(raw.weekly),
      emergencyName: text(raw.emergencyName, ''),
      emergencyPhone: text(raw.emergencyPhone, ''),
      employmentKind: employment,
      mobileMoney: text(raw.mobileMoney, ''),
    },
  };
}

/** Garde le brouillon 7 jours de plus ; `false` si le stockage le refuse. */
export function saveDraft(userId: string, draft: ApplicationDraft, now: number = Date.now()): boolean {
  return writeStored<StoredDraft>(DRAFT_KEY, { userId, draft }, DRAFT_DAYS, now);
}

/** Candidature envoyée (ou déjà enregistrée) : le brouillon n'a plus lieu d'être. */
export function clearDraft(): void {
  removeStored(DRAFT_KEY);
}
