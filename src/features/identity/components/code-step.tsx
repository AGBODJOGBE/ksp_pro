'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { BottomBar } from '@/components/ui/bottom-bar';
import { Button, ButtonArrow } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { IconArrowLeft, IconChevronRight } from '@/components/ui/icons';
import { getDictionary } from '@/i18n';
import type { Session } from '@/lib/api';
import { requestOtp, verifyOtp } from '@/features/identity/api';
import { useCountdown } from '@/features/identity/countdown';
import { describeError } from '@/features/identity/errors';
import { cleanCode, isCodeComplete } from '@/features/identity/phone';
import type { OtpChannel } from '@/features/identity/channels';
import type { OtpChallenge } from '@/features/identity/schemas';
import { LoginCardHeader } from './login-card-header';

const CODE_ID = 'connexion-code';

/**
 * Étape 2 : saisie du code reçu. Renvoi possible, par le même canal, après le délai annoncé par la
 * gateway (`resendAfterSeconds`, ou `retryAfterSeconds` d'une limite atteinte).
 */
export function CodeStep({
  phone,
  channel,
  challenge: initialChallenge,
  onVerified,
  onChangeNumber,
}: {
  phone: string;
  /** Canal choisi à l'étape du numéro, repris pour un renvoi. */
  channel: OtpChannel;
  challenge: OtpChallenge;
  /** Code accepté : session ouverte (le cookie de renouvellement est posé par la gateway). */
  onVerified: (session: Session) => void;
  onChangeNumber: () => void;
}) {
  const t = getDictionary();
  const [challenge, setChallenge] = useState(initialChallenge);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [newCodeNeeded, setNewCodeNeeded] = useState(false);
  const [pending, setPending] = useState<'verify' | 'resend' | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const resend = useCountdown();
  const { start } = resend;

  // Arrivée sur l'écran : le clavier numérique s'ouvre, le message d'envoi est lu avec le champ.
  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  useEffect(() => {
    start(initialChallenge.resendAfterSeconds);
  }, [initialChallenge, start]);

  function fail(caught: unknown) {
    const view = describeError(caught);
    if (view.retryAfterSeconds) resend.start(view.retryAfterSeconds);
    if (view.newCodeNeeded) {
      setNewCodeNeeded(true);
      resend.start(0);
    }
    if (view.field === 'code') {
      setCodeError(view.message);
      setCode('');
      codeRef.current?.focus();
    } else {
      setError(view.message);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || newCodeNeeded) return;
    setError(null);
    setInfo(null);
    setCodeError(null);
    if (!isCodeComplete(code)) {
      setCodeError(t.login.codeInvalid);
      codeRef.current?.focus();
      return;
    }
    setPending('verify');
    try {
      const result = await verifyOtp(challenge.challengeId, code);
      if (result.status === 'mfa_required') setError(t.login.mfaRequired);
      else onVerified(result.session);
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(null);
    }
  }

  async function sendAgain() {
    if (pending || resend.remaining > 0) return;
    setError(null);
    setInfo(null);
    setCodeError(null);
    setPending('resend');
    try {
      const next = await requestOtp(phone, channel);
      setChallenge(next);
      setCode('');
      setNewCodeNeeded(false);
      resend.start(next.resendAfterSeconds);
      setInfo(t.login.resent);
      codeRef.current?.focus();
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(null);
    }
  }

  const sentId = `${CODE_ID}-envoi`;
  const canResend = resend.remaining === 0;

  return (
    <section aria-labelledby="code-titre">
      <LoginCardHeader id="code-titre" title={t.login.codeTitle}>
        <p id={sentId}>
          {t.login.codeSent(challenge.channel, challenge.maskedTarget)}{' '}
          {t.login.codeValidity(Math.max(1, Math.round(challenge.expiresInSeconds / 60)))}
        </p>
      </LoginCardHeader>
      <form noValidate onSubmit={submit} className="mt-7 grid gap-5">
        <TextField
          id={CODE_ID}
          inputRef={codeRef}
          label={t.login.codeLabel}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={8}
          value={code}
          onChange={(event) => setCode(cleanCode(event.target.value))}
          aria-describedby={sentId}
          error={codeError}
          inputClassName="min-h-16 text-center text-2xl font-semibold tracking-[0.35em] tabular-nums"
        />
        <FormMessage>{error}</FormMessage>
        <FormMessage tone="info">{info}</FormMessage>
        <div className="grid gap-2">
          <Button
            variant={newCodeNeeded ? 'primary' : 'secondary'}
            onClick={sendAgain}
            disabled={!canResend}
            aria-busy={pending === 'resend' || undefined}
            className="w-full"
          >
            {canResend ? t.login.resend : t.login.resendIn(t.login.delay(resend.remaining))}
          </Button>
          <Button variant="ghost" onClick={onChangeNumber} className="w-full">
            <IconArrowLeft />
            {t.login.changeNumber}
          </Button>
        </div>
        <BottomBar>
          <Button
            type="submit"
            size="lg"
            variant="action"
            className="w-full"
            disabled={newCodeNeeded}
            aria-busy={pending === 'verify' || undefined}
          >
            {pending === 'verify' ? t.login.verifying : t.login.verify}
            <ButtonArrow>
              <IconChevronRight />
            </ButtonArrow>
          </Button>
        </BottomBar>
      </form>
    </section>
  );
}
