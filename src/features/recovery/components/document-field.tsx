'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, fieldIds } from '@/components/ui/field';
import { IconCheck, IconCloudUp } from '@/components/ui/icons';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { uploadFile } from '@/features/file';
import { EVIDENCE_MAX_BYTES, EVIDENCE_TYPES } from '@/features/recovery/evidence';
import { DocumentGlyph } from './icons';

/** Pièce déposée : identifiant du service file, nom affiché. */
export interface DocumentValue {
  id: string;
  name: string;
}

export interface DocumentFieldTexts {
  choose: string;
  replace: string;
  remove: string;
  uploading: string;
  uploaded: (name: string) => string;
  wrongType: string;
  tooLarge: string;
  failed: string;
}

/**
 * Une pièce du Recouvrement (acte, preuve d'un encaissement) : PDF ou image (JPEG, PNG, WebP), 10 Mo au
 * plus (finalité `recovery_evidence`). Déposée telle quelle, sans compression : un acte doit rester
 * lisible. Déposée aussitôt choisie (déclaration, envoi au stockage, confirmation) ; seul son identifiant
 * part avec le formulaire.
 */
export function DocumentField({
  id,
  label,
  hint,
  value,
  onChange,
  texts: t,
  error,
  disabled,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  value: DocumentValue | null;
  onChange: (value: DocumentValue | null) => void;
  texts: DocumentFieldTexts;
  error?: string | null;
  disabled?: boolean;
}) {
  const ids = fieldIds(id);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setProblem(null);
    if (!EVIDENCE_TYPES.includes(file.type)) return setProblem(t.wrongType);
    if (file.size > EVIDENCE_MAX_BYTES) return setProblem(t.tooLarge);
    setUploading(true);
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    try {
      const stored = await uploadFile(file, 'recovery_evidence', current.signal);
      onChange({ id: stored.id, name: file.name });
    } catch (caught) {
      if (current.signal.aborted) return;
      setProblem(caught instanceof ApiError ? caught.message : t.failed);
    } finally {
      if (!current.signal.aborted) setUploading(false);
    }
  }

  const shown = problem ?? error;
  return (
    <div
      role="group"
      aria-labelledby={`${id}-libelle`}
      aria-describedby={cn(hint ? ids.hint : null, shown ? ids.error : null) || undefined}
      className="grid gap-3"
    >
      <p id={`${id}-libelle`} className="text-ink font-semibold">
        {label}
      </p>
      {hint ? (
        <p id={ids.hint} className="text-small text-ink-muted -mt-2">
          {hint}
        </p>
      ) : null}
      {value ? (
        <p className="rounded-control border-action-muted bg-action-soft text-action-ink flex items-start gap-2 border p-3 font-semibold">
          <DocumentGlyph className="mt-0.5 size-5 shrink-0" />
          <span className="min-w-0 break-all">{t.uploaded(value.name)}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={cn(
            'rounded-control border-line-strong bg-surface text-ink hover:bg-surface-sunken inline-flex min-h-12 cursor-pointer items-center gap-2 border px-5 font-semibold',
            'has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
            (disabled || uploading) && 'cursor-not-allowed opacity-60',
          )}
        >
          {value ? <IconCheck className="size-5" /> : <IconCloudUp className="size-5" />}
          {value ? t.replace : t.choose}
          <input
            id={id}
            type="file"
            accept={EVIDENCE_TYPES.join(',')}
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(event) => {
              void pick(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
        {value && !uploading ? (
          <Button variant="ghost" onClick={() => onChange(null)} disabled={disabled}>
            {t.remove}
          </Button>
        ) : null}
      </div>
      <p role="status" className="text-small text-ink-muted empty:hidden">
        {uploading ? t.uploading : ''}
      </p>
      {shown ? <FieldError id={ids.error}>{shown}</FieldError> : null}
    </div>
  );
}
