'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getDictionary } from '@/i18n';
import { isDeletionPending, type Session, session } from '@/lib/api';
import { formatPhone } from '@/lib/phone';
import { RETURN_PARAM, safeReturnPath } from '@/features/identity/return-path';
import type { OtpChannel } from '@/features/identity/channels';
import type { OtpChallenge } from '@/features/identity/schemas';
import { CodeStep } from './code-step';
import { DeletionPending } from './deletion-pending';
import { PhoneStep } from './phone-step';
import { ProfileForm } from './profile-form';

type Step =
  | { name: 'checking' }
  | { name: 'phone'; phone?: string; channel?: OtpChannel }
  | { name: 'code'; phone: string; channel: OtpChannel; challenge: OtpChallenge }
  | { name: 'profile' }
  | { name: 'deletion' };

/**
 * Parcours de connexion par téléphone : numéro et canal, code, puis profil si le nom manque ; ensuite
 * retour à la page demandée (`?retour=`, chemin interne uniquement), sinon au choix de l'espace.
 *
 * Au chargement, une session encore valide (cookie de renouvellement) est reprise sans rien demander.
 * Compte en cours de suppression (session restreinte, ADR-036) : explication et lien vers le portail.
 */
export function LoginFlow() {
  const t = getDictionary();
  const { replace } = useRouter();
  const returnPath = safeReturnPath(useSearchParams().get(RETURN_PARAM));
  const [step, setStep] = useState<Step>({ name: 'checking' });
  const numberRef = useRef<HTMLInputElement>(null);
  const backToPhone = useRef(false);

  useEffect(() => {
    let active = true;
    session.restore().then((result) => {
      if (!active) return;
      if (result.status !== 'authenticated') return setStep({ name: 'phone' });
      if (isDeletionPending(result.session)) return setStep({ name: 'deletion' });
      if (result.session.profileIncomplete) return setStep({ name: 'profile' });
      replace(returnPath);
    });
    return () => {
      active = false;
    };
  }, [replace, returnPath]);

  // Retour depuis l'écran du code : le focus revient sur le numéro à corriger.
  useEffect(() => {
    if (step.name === 'phone' && backToPhone.current) {
      backToPhone.current = false;
      numberRef.current?.focus();
    }
  }, [step]);

  function verified(opened: Session) {
    session.set(opened);
    if (isDeletionPending(opened)) setStep({ name: 'deletion' });
    else if (opened.profileIncomplete) setStep({ name: 'profile' });
    else replace(returnPath);
  }

  switch (step.name) {
    case 'checking':
      return (
        <p role="status" className="text-ink-muted text-center">
          {t.login.checking}
        </p>
      );
    case 'phone':
      return (
        <PhoneStep
          initialPhone={step.phone ? formatPhone(step.phone) : undefined}
          initialChannel={step.channel}
          numberRef={numberRef}
          onSent={(phone, channel, challenge) => setStep({ name: 'code', phone, channel, challenge })}
        />
      );
    case 'code':
      return (
        <CodeStep
          phone={step.phone}
          channel={step.channel}
          challenge={step.challenge}
          onVerified={verified}
          onChangeNumber={() => {
            backToPhone.current = true;
            setStep({ name: 'phone', phone: step.phone, channel: step.channel });
          }}
        />
      );
    case 'profile':
      return <ProfileForm autoFocus onDone={() => replace(returnPath)} />;
    case 'deletion':
      return <DeletionPending />;
  }
}
