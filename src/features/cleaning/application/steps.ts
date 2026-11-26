import { ApiError } from '@/lib/api';
import { phoneFromInput } from '@/lib/phone';
import type { ApplicationBody } from '@/features/cleaning/application-api';
import { hasRanges, rulesFromWeek, weekProblems } from '@/features/cleaning/weekly';
import type { ApplicationDraft } from './draft';
import { applicationTexts } from './texts';

/**
 * Étapes de la candidature, vérification de la saisie de chaque étape (champs obligatoires, numéros,
 * plages lisibles), corps envoyé à la gateway et lecture de ses refus. La gateway reste seule juge :
 * compétences et communes connues, invitation, chevauchement des plages.
 */

export const STEPS = [
  'identity',
  'photo',
  'idDocument',
  'residence',
  'zones',
  'skills',
  'availability',
  'emergency',
  'employment',
  'mobileMoney',
  'summary',
] as const;
export type StepKey = (typeof STEPS)[number];

/** Messages d'erreur par champ (`firstName`, `idFront`, `weekly`…). */
export type StepErrors = Partial<Record<string, string>>;

const NAME_MAX = 100;
const e = applicationTexts.errors;

function name(value: string, missing: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return missing;
  return trimmed.length > NAME_MAX ? e.tooLong : undefined;
}

/** Erreurs de saisie d'une étape (vide : l'étape est complète). */
export function validateStep(
  step: StepKey,
  draft: ApplicationDraft,
  options: { skillsAvailable: boolean },
): StepErrors {
  const errors: StepErrors = {};
  switch (step) {
    case 'identity':
      errors.firstName = name(draft.firstName, e.firstName);
      errors.lastName = name(draft.lastName, e.lastName);
      break;
    case 'photo':
      if (!draft.photo) errors.photo = e.photo;
      break;
    case 'idDocument':
      if (!draft.idFront) errors.idFront = e.idFront;
      if (!draft.idBack) errors.idBack = e.idBack;
      break;
    case 'residence':
      if (!draft.residenceCommuneKey) errors.residence = e.residence;
      break;
    case 'zones':
      if (!draft.zoneKeys.length) errors.zones = e.zones;
      break;
    case 'skills':
      // Sans liste lisible (B4), l'étape se passe : l'envoi est bloqué au récapitulatif.
      if (options.skillsAvailable && !draft.skillCodes.length) errors.skills = e.skills;
      break;
    case 'availability':
      if (!hasRanges(draft.weekly)) errors.weekly = e.availability;
      else if (Object.keys(weekProblems(draft.weekly)).length) errors.weekly = e.availabilityRanges;
      break;
    case 'emergency':
      errors.emergencyName = name(draft.emergencyName, e.emergencyName);
      if (!phoneFromInput(draft.emergencyPhone)) errors.emergencyPhone = e.emergencyPhone;
      break;
    case 'employment':
      if (!draft.employmentKind) errors.employment = e.employment;
      break;
    case 'mobileMoney':
      if (draft.mobileMoney.trim() && !phoneFromInput(draft.mobileMoney)) errors.mobileMoney = e.mobileMoney;
      break;
    case 'summary':
      break;
  }
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as StepErrors;
}

/** Première étape incomplète avant le récapitulatif, ou `null`. */
export function firstIncompleteStep(
  draft: ApplicationDraft,
  options: { skillsAvailable: boolean },
): StepKey | null {
  return STEPS.find((step) => Object.keys(validateStep(step, draft, options)).length > 0) ?? null;
}

/** Corps de `POST /cleaning/agent/applications`, à partir d'un brouillon complet. */
export function applicationBody(draft: ApplicationDraft, invitationId: string | null): ApplicationBody {
  const mobileMoney = draft.mobileMoney.trim() ? phoneFromInput(draft.mobileMoney) : null;
  return {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    photoFileId: draft.photo?.id ?? '',
    idDocumentFrontFileId: draft.idFront?.id ?? '',
    idDocumentBackFileId: draft.idBack?.id ?? '',
    residenceCommuneKey: draft.residenceCommuneKey,
    zoneKeys: [...draft.zoneKeys],
    skillCodes: [...draft.skillCodes],
    weekly: rulesFromWeek(draft.weekly),
    emergencyContact: {
      name: draft.emergencyName.trim(),
      phone: phoneFromInput(draft.emergencyPhone) ?? draft.emergencyPhone.trim(),
    },
    employmentKind: draft.employmentKind === 'employee' ? 'employee' : 'independent',
    ...(mobileMoney ? { mobileMoneyNumber: mobileMoney } : {}),
    ...(invitationId ? { invitationId } : {}),
  };
}

/** Lecture d'un refus de la gateway à l'envoi. */
export type SubmitProblem =
  /** Le compte a déjà une candidature : afficher son état (`GET /cleaning/agent/me`). */
  | { kind: 'already'; message: string }
  /** Invitation refusée : proposer d'envoyer sans elle. */
  | { kind: 'invitation'; message: string }
  /** Une étape à corriger, avec le champ en cause. */
  | { kind: 'step'; step: StepKey; field: string; message: string }
  /** La clé a servi pour un autre contenu : nouvel envoi avec une clé neuve. */
  | { kind: 'key'; message: string }
  /** Le reste (réseau, panne, service indisponible) : même envoi, même clé. */
  | { kind: 'other'; message: string; correlationId?: string };

/** Champ du contrat → étape et champ de l'écran. */
const FIELDS: Array<[RegExp, StepKey, string]> = [
  [/^firstName/, 'identity', 'firstName'],
  [/^lastName/, 'identity', 'lastName'],
  [/^photoFileId/, 'photo', 'photo'],
  [/^idDocumentFrontFileId/, 'idDocument', 'idFront'],
  [/^idDocumentBackFileId/, 'idDocument', 'idBack'],
  [/^residenceCommuneKey/, 'residence', 'residence'],
  [/^zoneKeys/, 'zones', 'zones'],
  [/^skillCodes/, 'skills', 'skills'],
  [/^weekly/, 'availability', 'weekly'],
  [/^emergencyContact\.?name/, 'emergency', 'emergencyName'],
  [/^emergencyContact/, 'emergency', 'emergencyPhone'],
  [/^employmentKind/, 'employment', 'employment'],
  [/^mobileMoneyNumber/, 'mobileMoney', 'mobileMoney'],
];

export function submitProblem(error: unknown): SubmitProblem {
  const t = applicationTexts.submitErrors;
  if (!(error instanceof ApiError)) return { kind: 'other', message: applicationTexts.genericError };
  const field = typeof error.details.field === 'string' ? error.details.field : '';
  switch (error.code) {
    case 'CLEANING_AGENT_ALREADY_REGISTERED':
      return { kind: 'already', message: t.already };
    case 'CLEANING_IDEMPOTENCY_KEY_REUSED':
      return { kind: 'key', message: t.keyReused };
    case 'CLEANING_ZONE_NOT_FOUND':
      return { kind: 'step', step: 'zones', field: 'zones', message: t.zone };
    case 'CLEANING_SKILL_NOT_FOUND':
      return { kind: 'step', step: 'skills', field: 'skills', message: t.skill };
    case 'CLEANING_GEO_UNAVAILABLE':
      return { kind: 'other', message: t.geo, correlationId: error.correlationId };
  }
  if (field === 'invitationId') {
    const reason = typeof error.details.reason === 'string' ? error.details.reason : '';
    // Motifs du back : `invitation_not_found`, `invitation_consumed`, `invitation_expired`.
    const key = reason.startsWith('invitation_') ? reason : `invitation_${reason}`;
    return { kind: 'invitation', message: t.invitation[key] ?? t.invitationDefault };
  }
  if (error.status === 400 && field) {
    const match = FIELDS.find(([pattern]) => pattern.test(field));
    if (match) return { kind: 'step', step: match[1], field: match[2], message: error.message };
  }
  return { kind: 'other', message: error.message, correlationId: error.correlationId };
}
