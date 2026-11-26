'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { ChoicePill, Fieldset, Panel } from '@/components/ui/form-fields';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { getPreferences, updatePreferences } from '@/features/notification/api';
import type { NotificationPreferences as Preferences } from '@/features/notification/schemas';
import { preferencesTexts as t } from '@/features/notification/preferences-texts';

const describe = (error: unknown) =>
  error instanceof ApiError
    ? error.correlationId
      ? `${error.message} (référence : ${error.correlationId})`
      : error.message
    : t.genericError;

/**
 * Préférences de notification du compte (`GET` et `PUT /notification/preferences`, ADR-039) : WhatsApp et
 * e-mail pour les messages facultatifs. Les messages importants partent toujours.
 */
export function NotificationPreferences() {
  const [saved, setSaved] = useState<Preferences | null>(null);
  const [draft, setDraft] = useState({ whatsapp: false, email: false });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getPreferences(controller.signal).then(
      (preferences) => {
        if (controller.signal.aborted) return;
        setSaved(preferences);
        setDraft({ whatsapp: preferences.whatsapp, email: preferences.email });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setLoadError(describe(error));
      },
    );
    return () => controller.abort();
  }, [attempt]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setMessage(null);
    try {
      const preferences = await updatePreferences(draft);
      setSaved(preferences);
      setDraft({ whatsapp: preferences.whatsapp, email: preferences.email });
      setMessage({ tone: 'success', text: t.saved });
    } catch (error) {
      setMessage({ tone: 'error', text: describe(error) });
    } finally {
      setSending(false);
    }
  }

  const changed = !!saved && (saved.whatsapp !== draft.whatsapp || saved.email !== draft.email);
  return (
    <Panel id="preferences-titre" title={t.title}>
      <p className="text-ink-muted">{t.lead}</p>
      {saved ? (
        <form onSubmit={save} className="mt-4 grid gap-4">
          <Fieldset id="preferences-canaux" legend={t.legend} legendClassName="sr-only">
            <div className="grid gap-2 sm:grid-cols-2">
              <ChoicePill
                type="checkbox"
                label={t.whatsapp}
                checked={draft.whatsapp}
                onChange={(event) =>
                  setDraft((previous) => ({ ...previous, whatsapp: event.target.checked }))
                }
              />
              <ChoicePill
                type="checkbox"
                label={t.email}
                hint={t.emailHint}
                checked={draft.email}
                onChange={(event) => setDraft((previous) => ({ ...previous, email: event.target.checked }))}
              />
            </div>
          </Fieldset>
          <FormMessage tone={message?.tone ?? 'error'}>{message?.text}</FormMessage>
          <Button
            type="submit"
            variant="primary"
            className="sm:justify-self-start"
            disabled={!changed || sending}
            aria-busy={sending || undefined}
          >
            {sending ? t.saving : t.save}
          </Button>
        </form>
      ) : loadError ? (
        <div className="mt-4 grid justify-items-start gap-3">
          <FormMessage>{loadError}</FormMessage>
          <Button
            variant="secondary"
            onClick={() => {
              setLoadError(null);
              setAttempt((value) => value + 1);
            }}
          >
            {t.retry}
          </Button>
        </div>
      ) : (
        <div role="status" className="mt-4 grid gap-2 sm:grid-cols-2">
          <span className="sr-only">{t.loading}</span>
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      )}
    </Panel>
  );
}
