'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { IconInvitation } from '@/components/ui/icons';
import { WizardNav, WizardProgress } from '@/components/ui/wizard';
import { ApiError, type Session } from '@/lib/api';
import { idempotentSubmission } from '@/lib/idempotency';
import {
  listApplicationSkills,
  listServedZones,
  type SkillOption,
  submitApplication,
} from '@/features/cleaning/application-api';
import {
  type ApplicationDraft,
  clearDraft,
  newDraft,
  readDraft,
  saveDraft,
} from '@/features/cleaning/application/draft';
import {
  applicationBody,
  firstIncompleteStep,
  STEPS,
  type StepErrors,
  type StepKey,
  type SubmitProblem,
  submitProblem,
  validateStep,
} from '@/features/cleaning/application/steps';
import { applicationTexts as t } from '@/features/cleaning/application/texts';
import { forgetInvitation, readInvitation, subscribeInvitation } from '@/features/cleaning/invitation';
import type { AgentProfile, PublicZone } from '@/features/cleaning/schemas';
import { ApplicationSummary } from './application-summary';
import { type Loaded, StepFields } from './application-steps';

const describe = (error: unknown) => (error instanceof ApiError ? error.message : t.genericError);

const STEP_NAMES = STEPS.map((step) => t.steps[step]);

/** Titre de chaque étape. */
const TITLES: Record<StepKey, string> = {
  identity: t.identity.title,
  photo: t.photo.title,
  idDocument: t.idDocument.title,
  residence: t.residence.title,
  zones: t.zones.title,
  skills: t.skills.title,
  availability: t.availability.title,
  emergency: t.emergency.title,
  employment: t.employment.title,
  mobileMoney: t.mobileMoney.title,
  summary: t.summary.title,
};

/** Champ du brouillon → champ des messages d'erreur, quand ils diffèrent. */
const ERROR_FIELDS: Record<string, string> = {
  residenceCommuneKey: 'residence',
  zoneKeys: 'zones',
  skillCodes: 'skills',
  employmentKind: 'employment',
};

/** Lecture d'une liste de la gateway, relancée par « Réessayer ». */
function useLoaded<T>(load: (signal: AbortSignal) => Promise<Loaded<T>>): [Loaded<T>, () => void] {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setState(result);
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: describe(error) });
      },
    );
    return () => controller.abort();
  }, [load, attempt]);
  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);
  return [state, retry];
}

const loadZones = async (signal: AbortSignal): Promise<Loaded<PublicZone[]>> => ({
  status: 'ready',
  data: await listServedZones(signal),
});

const loadSkills = async (signal: AbortSignal): Promise<Loaded<SkillOption[]>> => {
  const result = await listApplicationSkills(signal);
  return result.status === 'ready' ? { status: 'ready', data: result.skills } : { status: 'unavailable' };
};

/**
 * Candidature d'un agent du Nettoyage, une étape par écran (téléphone, une main) : identité, photo,
 * pièce d'identité, commune, zones, compétences, disponibilités, personne à prévenir, statut, Mobile
 * Money, récapitulatif. Brouillon gardé à chaque saisie sur l'appareil (7 jours, rattaché au compte) ;
 * envoi avec une clé d'idempotence (un nouvel essai du même contenu ne crée rien de plus).
 */
export function ApplicationForm({
  session,
  onSubmitted,
  onAlreadyRegistered,
}: {
  session: Session;
  onSubmitted: (profile: AgentProfile) => void;
  onAlreadyRegistered: (message: string) => void;
}) {
  const userId = session.user.id;
  const [restored] = useState(() => readDraft(userId, session.user));
  const [draft, setDraft] = useState<ApplicationDraft>(() => restored?.draft ?? newDraft(session.user));
  const [errors, setErrors] = useState<StepErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<SubmitProblem | null>(null);
  const submission = useRef(idempotentSubmission());
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  // Messages d'accueil (brouillon retrouvé, photos effacées) : jusqu'au premier changement d'étape.
  const [welcome, setWelcome] = useState(true);
  const invitation = useSyncExternalStore(subscribeInvitation, readInvitation, () => null);
  const [zones, retryZones] = useLoaded(loadZones);
  const [skills, retrySkills] = useLoaded(loadSkills);

  const index = Math.min(Math.max(draft.step, 0), STEPS.length - 1);
  const step = STEPS[index] ?? 'identity';
  const skillsAvailable = skills.status === 'ready';
  const options = { skillsAvailable };

  // Brouillon gardé à chaque modification (7 jours de plus).
  useEffect(() => {
    saveDraft(userId, draft);
  }, [userId, draft]);

  // Nouvelle étape : le titre reçoit le focus (lecteurs d'écran), la page remonte.
  useEffect(() => {
    if (!moved.current) return;
    heading.current?.focus();
    heading.current?.scrollIntoView?.({ block: 'start' });
  }, [index]);

  // Erreurs affichées : le premier champ en cause reçoit le focus.
  useEffect(() => {
    if (!Object.keys(errors).length) return;
    const first = Object.keys(errors)[0] ?? '';
    const root = form.current;
    const invalid =
      root?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      root?.querySelector<HTMLElement>(`#candidature-${first}, [name="candidature-${first}"]`) ??
      root?.querySelector<HTMLElement>('section input, section select');
    invalid?.focus();
  }, [errors]);

  const update = useCallback((patch: Partial<ApplicationDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    // Un champ corrigé perd son message d'erreur.
    const fields = Object.keys(patch).map((key) => ERROR_FIELDS[key] ?? key);
    setErrors((previous) =>
      fields.some((field) => field in previous)
        ? Object.fromEntries(Object.entries(previous).filter(([field]) => !fields.includes(field)))
        : previous,
    );
  }, []);

  function goTo(target: StepKey, nextErrors: StepErrors = {}) {
    moved.current = true;
    setWelcome(false);
    setErrors(nextErrors);
    setDraft((previous) => ({ ...previous, step: STEPS.indexOf(target) }));
  }

  function next() {
    const found = validateStep(step, draft, options);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    const following = STEPS[index + 1];
    if (following) goTo(following);
  }

  async function submit() {
    const incomplete = firstIncompleteStep(draft, options);
    if (incomplete && incomplete !== 'summary') {
      goTo(incomplete, validateStep(incomplete, draft, options));
      return;
    }
    if (!skillsAvailable || submitting) return;
    const body = applicationBody(draft, invitation);
    const key = submission.current.keyFor(body);
    setSubmitting(true);
    setProblem(null);
    try {
      const profile = await submitApplication(body, key);
      submission.current.done();
      clearDraft();
      forgetInvitation();
      onSubmitted(profile);
    } catch (error) {
      const found = submitProblem(error);
      if (found.kind === 'already') {
        clearDraft();
        forgetInvitation();
        onAlreadyRegistered(found.message);
        return;
      }
      if (found.kind === 'key') submission.current.done();
      // Invitation refusée par la gateway : oubliée, l'envoi suivant part sans elle.
      if (found.kind === 'invitation') forgetInvitation();
      if (found.kind === 'step') goTo(found.step, { [found.field]: found.message });
      setProblem(found);
    } finally {
      setSubmitting(false);
    }
  }

  const summary = step === 'summary';
  const problemText =
    problem && problem.kind !== 'step'
      ? problem.kind === 'other' && problem.correlationId
        ? `${problem.message} (référence : ${problem.correlationId})`
        : problem.message
      : null;

  return (
    <div ref={form} className="grid grid-cols-1 gap-6">
      <div className="grid gap-2">
        <Heading as="h1" size="h2">
          {t.title}
        </Heading>
        {index === 0 ? <p className="text-ink-muted text-lg">{t.lead}</p> : null}
      </div>
      {restored && welcome && restored.draft.step > 0 ? (
        <FormMessage tone="info">{t.restored}</FormMessage>
      ) : null}
      {restored?.filesExpired && welcome ? <FormMessage tone="info">{t.filesExpired}</FormMessage> : null}
      {invitation && index === 0 ? (
        <p className="rounded-card border-accent bg-accent-soft text-ink flex items-start gap-3 border-2 p-4 font-semibold">
          <IconInvitation className="text-accent-ink mt-0.5 size-6 shrink-0" />
          {t.invitationKept}
        </p>
      ) : null}
      <WizardProgress steps={STEP_NAMES} index={index} progressLabel={t.progress(index, STEPS.length)} />
      <section aria-labelledby="candidature-etape" className="grid gap-5">
        <h2
          id="candidature-etape"
          ref={heading}
          tabIndex={-1}
          className="font-display text-h3 text-ink scroll-mt-24 font-semibold focus:outline-none"
        >
          {TITLES[step]}
        </h2>
        {summary ? (
          <ApplicationSummary
            draft={draft}
            zones={zones.status === 'ready' ? zones.data : []}
            skills={skills.status === 'ready' ? skills.data : []}
            invitation={!!invitation}
            onEdit={(target) => goTo(target)}
            disabled={submitting}
          />
        ) : (
          <StepFields
            step={step}
            draft={draft}
            update={update}
            errors={errors}
            zones={zones}
            skills={skills}
            onRetryZones={retryZones}
            onRetrySkills={retrySkills}
            disabled={submitting}
          />
        )}
        {summary && !skillsAvailable && skills.status !== 'loading' ? (
          <FormMessage tone="info">{t.skillsPending.blocked}</FormMessage>
        ) : null}
        {summary ? <FormMessage>{problemText}</FormMessage> : null}
        {summary && problem?.kind === 'invitation' ? (
          <Button variant="secondary" className="justify-self-start" onClick={submit} disabled={submitting}>
            {t.submitErrors.sendWithout}
          </Button>
        ) : null}
      </section>
      <WizardNav
        showBack={index > 0}
        busy={submitting}
        backLabel={t.back}
        nextLabel={summary ? (submitting ? t.submitting : t.submit) : t.next}
        arrow={!summary}
        nextDisabled={summary && !skillsAvailable}
        onBack={() => {
          const previous = STEPS[index - 1];
          if (previous) goTo(previous);
        }}
        onNext={summary ? submit : next}
      />
    </div>
  );
}
