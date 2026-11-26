import { ApiError } from '@/lib/api';
import { completeDraft as fixture } from '@/features/cleaning/cleaning.test-utils';
import { emptyWeek } from '@/features/cleaning/weekly';
import { newDraft } from './draft';
import { applicationBody, firstIncompleteStep, submitProblem, validateStep } from './steps';

const completeDraft = () =>
  fixture({
    photo: { id: 'f1', name: 'f1.jpg', uploadedAt: 0 },
    idFront: { id: 'f2', name: 'f2.jpg', uploadedAt: 0 },
    idBack: { id: 'f3', name: 'f3.jpg', uploadedAt: 0 },
  });

const available = { skillsAvailable: true };

describe('vérification des étapes', () => {
  it('signale les champs obligatoires de chaque étape', () => {
    const draft = { ...newDraft({ firstName: ' ', lastName: null }) };
    expect(validateStep('identity', draft, available)).toEqual({
      firstName: 'Saisissez votre prénom.',
      lastName: 'Saisissez votre nom.',
    });
    expect(validateStep('idDocument', draft, available)).toEqual({
      idFront: 'Ajoutez le recto de votre pièce d’identité.',
      idBack: 'Ajoutez le verso de votre pièce d’identité.',
    });
    expect(validateStep('zones', draft, available)).toEqual({ zones: 'Choisissez au moins une commune.' });
    expect(validateStep('availability', draft, available)).toEqual({
      weekly: 'Ajoutez au moins une plage horaire.',
    });
    expect(validateStep('employment', draft, available)).toEqual({ employment: 'Choisissez votre statut.' });
  });

  it('vérifie les numéros, les longueurs et les plages', () => {
    const draft = {
      ...completeDraft(),
      lastName: 'x'.repeat(101),
      emergencyPhone: '12',
      mobileMoney: 'abc',
      weekly: { ...emptyWeek(), tue: [{ start: '17:00', end: '08:00' }] },
    };
    expect(validateStep('identity', draft, available)).toEqual({ lastName: '100 caractères au plus.' });
    expect(validateStep('emergency', draft, available)).toEqual({
      emergencyPhone: 'Numéro invalide : vérifiez-le.',
    });
    expect(validateStep('mobileMoney', draft, available)).toEqual({
      mobileMoney: 'Numéro invalide : vérifiez-le, ou laissez le champ vide.',
    });
    expect(validateStep('availability', draft, available)).toEqual({
      weekly: 'Corrigez les plages signalées.',
    });
  });

  it('sans liste de compétences lisible (B4), l’étape se passe', () => {
    const draft = { ...completeDraft(), skillCodes: [] };
    expect(validateStep('skills', draft, { skillsAvailable: false })).toEqual({});
    expect(validateStep('skills', draft, available)).toEqual({
      skills: 'Choisissez au moins une compétence.',
    });
  });

  it('trouve la première étape incomplète', () => {
    expect(firstIncompleteStep(completeDraft(), available)).toBeNull();
    expect(firstIncompleteStep({ ...completeDraft(), idBack: null }, available)).toBe('idDocument');
  });
});

describe('corps envoyé', () => {
  it('suit le contrat : numéros en E.164, jours avec plages, champs facultatifs omis', () => {
    expect(applicationBody(completeDraft(), null)).toEqual({
      firstName: 'Koffi',
      lastName: 'Adjovi',
      photoFileId: 'f1',
      idDocumentFrontFileId: 'f2',
      idDocumentBackFileId: 'f3',
      residenceCommuneKey: 'cotonou',
      zoneKeys: ['cotonou', 'abomey-calavi'],
      skillCodes: ['interior_cleaning'],
      weekly: [{ weekday: 'mon', ranges: [{ start: '08:00', end: '17:00' }] }],
      emergencyContact: { name: 'Afi Adjovi', phone: '+2290197000046' },
      employmentKind: 'independent',
    });
  });

  it('joint le Mobile Money et l’invitation', () => {
    const body = applicationBody({ ...completeDraft(), mobileMoney: '97 00 00 47' }, 'i1');
    expect(body.mobileMoneyNumber).toBe('+2290197000047');
    expect(body.invitationId).toBe('i1');
  });
});

const refusal = (status: number, code: string, details: Record<string, unknown> = {}) =>
  new ApiError(status, code, 'Message de la gateway.', details, 'c-1');

describe('refus de la gateway', () => {
  it.each([
    [refusal(409, 'CLEANING_AGENT_ALREADY_REGISTERED'), 'already'],
    [refusal(409, 'CLEANING_IDEMPOTENCY_KEY_REUSED'), 'key'],
    [refusal(503, 'CLEANING_GEO_UNAVAILABLE'), 'other'],
    [ApiError.network(), 'other'],
  ])('%s → %s', (error, kind) => {
    expect(submitProblem(error).kind).toBe(kind);
  });

  it('invitation refusée : message selon le motif', () => {
    for (const reason of ['invitation_not_found', 'invitation_consumed', 'invitation_expired', 'expired']) {
      const problem = submitProblem(
        refusal(400, 'CLEANING_VALIDATION_FAILED', { field: 'invitationId', reason }),
      );
      expect(problem.kind).toBe('invitation');
      expect(problem.message).toMatch(/sans invitation/);
    }
  });

  it('zone ou compétence introuvable, champ refusé : retour à l’étape en cause', () => {
    expect(submitProblem(refusal(404, 'CLEANING_ZONE_NOT_FOUND'))).toMatchObject({
      kind: 'step',
      step: 'zones',
    });
    expect(submitProblem(refusal(404, 'CLEANING_SKILL_NOT_FOUND'))).toMatchObject({
      kind: 'step',
      step: 'skills',
    });
    expect(
      submitProblem(refusal(400, 'CLEANING_VALIDATION_FAILED', { field: 'weekly[0].ranges[1].end' })),
    ).toEqual({ kind: 'step', step: 'availability', field: 'weekly', message: 'Message de la gateway.' });
    expect(
      submitProblem(refusal(400, 'CLEANING_VALIDATION_FAILED', { field: 'emergencyContact.phone' })),
    ).toMatchObject({ step: 'emergency', field: 'emergencyPhone' });
  });
});
