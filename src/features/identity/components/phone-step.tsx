'use client';

import { type FormEvent, type RefObject, useState } from 'react';
import { BottomBar } from '@/components/ui/bottom-bar';
import { Button, ButtonArrow } from '@/components/ui/button';
import { fieldIds, FieldError, FormMessage, inputClasses } from '@/components/ui/field';
import { ChoicePill } from '@/components/ui/form-fields';
import { IconAlert, IconChevronRight } from '@/components/ui/icons';
import { getDictionary } from '@/i18n';
import { formatPhone } from '@/lib/phone';
import { requestOtp } from '@/features/identity/api';
import { useCountdown } from '@/features/identity/countdown';
import { describeError } from '@/features/identity/errors';
import { DEFAULT_COUNTRY_CODE, readPhoneInput } from '@/features/identity/phone';
import { OTP_CHANNELS, type OtpChannel } from '@/features/identity/channels';
import type { OtpChallenge } from '@/features/identity/schemas';
import { LoginCardHeader } from './login-card-header';

const PHONE_ID = 'connexion-numero';

/**
 * Étape 1 : numéro de téléphone (indicatif +229 par défaut, tout pays accepté) et canal du code. Le SMS
 * est proposé d'abord : un agent de terrain n'a pas toujours WhatsApp ni de données mobiles.
 */
export function PhoneStep({
  initialPhone,
  initialChannel = 'sms',
  numberRef,
  onSent,
}: {
  /** Numéro déjà saisi (retour depuis l'écran du code) : on repart de l'indicatif par défaut. */
  initialPhone?: string;
  initialChannel?: OtpChannel;
  numberRef: RefObject<HTMLInputElement | null>;
  onSent: (phone: string, channel: OtpChannel, challenge: OtpChallenge) => void;
}) {
  const t = getDictionary();
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [number, setNumber] = useState(initialPhone ?? '');
  const [channel, setChannel] = useState<OtpChannel>(initialChannel);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const wait = useCountdown();
  const ids = fieldIds(PHONE_ID);
  const convertedId = `${PHONE_ID}-converti`;
  const blocked = wait.remaining > 0;
  // Ancien numéro béninois à 8 chiffres : la forme à 10 chiffres envoyée est montrée pendant la saisie.
  const input = readPhoneInput(countryCode, number);
  const converted = input.converted && input.phone ? formatPhone(input.phone) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || blocked) return;
    setError(null);
    setPhoneError(null);
    const { phone } = input;
    if (!phone) {
      setPhoneError(t.login.phoneInvalid);
      numberRef.current?.focus();
      return;
    }
    setPending(true);
    try {
      onSent(phone, channel, await requestOtp(phone, channel));
    } catch (caught) {
      const view = describeError(caught);
      if (view.retryAfterSeconds) wait.start(view.retryAfterSeconds);
      if (view.field === 'phone') {
        setPhoneError(view.message);
        numberRef.current?.focus();
      } else {
        setError(view.message);
      }
    } finally {
      setPending(false);
    }
  }

  const describedBy = [ids.hint, converted ? convertedId : null, phoneError ? ids.error : null]
    .filter(Boolean)
    .join(' ');

  return (
    <section aria-labelledby="connexion-titre">
      <LoginCardHeader id="connexion-titre" title={t.login.title}>
        {t.login.subtitle}
      </LoginCardHeader>
      <p className="text-ink-muted mt-6">{t.login.intro}</p>
      <form noValidate onSubmit={submit} className="mt-6 grid gap-6">
        <fieldset>
          <legend className="font-display text-ink text-lg font-bold">{t.login.phoneLegend}</legend>
          <p id={ids.hint} className="text-ink-muted mt-1">
            {t.login.phoneHint}
          </p>
          <div className="mt-2 flex gap-2">
            <div className="w-24 shrink-0">
              <label htmlFor="connexion-indicatif" className="sr-only">
                {t.login.countryCode}
              </label>
              <input
                id="connexion-indicatif"
                type="tel"
                inputMode="tel"
                autoComplete="tel-country-code"
                maxLength={6}
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                aria-invalid={phoneError ? true : undefined}
                aria-describedby={describedBy}
                className={inputClasses({
                  invalid: !!phoneError,
                  className: 'min-h-14 text-center text-lg tabular-nums',
                })}
              />
            </div>
            <div className="relative min-w-0 flex-1">
              <label htmlFor={PHONE_ID} className="sr-only">
                {t.login.phoneNumber}
              </label>
              <input
                id={PHONE_ID}
                ref={numberRef}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                maxLength={20}
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                aria-invalid={phoneError ? true : undefined}
                aria-describedby={describedBy}
                className={inputClasses({
                  invalid: !!phoneError,
                  className: 'min-h-14 text-lg font-semibold tabular-nums',
                })}
              />
              {phoneError ? (
                <IconAlert className="text-danger pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2" />
              ) : null}
            </div>
          </div>
          {/* Zone annoncée posément, présente avant son contenu pour être lue quand il apparaît. */}
          <p id={convertedId} aria-live="polite" className="text-small text-ink mt-2 empty:hidden">
            {converted ? (
              <>
                <span className="font-semibold tabular-nums">{t.login.phoneConverted(converted)}</span>{' '}
                {t.login.phoneTenDigits}
              </>
            ) : null}
          </p>
          {phoneError ? <FieldError id={ids.error}>{phoneError}</FieldError> : null}
        </fieldset>
        <fieldset>
          <legend className="font-display text-ink text-lg font-bold">{t.login.channelLegend}</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {OTP_CHANNELS.map((option) => (
              <ChoicePill
                key={option}
                name="canal"
                value={option}
                checked={channel === option}
                onChange={() => setChannel(option)}
                label={t.login.channels[option]}
                className="min-h-14 text-lg"
              />
            ))}
          </div>
        </fieldset>
        <p className="text-small text-ink-muted -mt-2">{t.login.newAccount}</p>
        <FormMessage>{error}</FormMessage>
        {/* Hors de la zone d'alerte : le décompte change chaque seconde et ne doit pas être relu. */}
        {blocked ? (
          <p className="text-small text-ink-muted -mt-2">{t.login.retryIn(t.login.delay(wait.remaining))}</p>
        ) : null}
        <BottomBar>
          <Button
            type="submit"
            size="lg"
            variant="action"
            className="w-full"
            disabled={blocked}
            aria-busy={pending || undefined}
          >
            {pending ? t.login.sending : t.login.sendCode}
            <ButtonArrow>
              <IconChevronRight />
            </ButtonArrow>
          </Button>
        </BottomBar>
      </form>
    </section>
  );
}
