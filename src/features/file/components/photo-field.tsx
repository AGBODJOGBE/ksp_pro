'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, fieldIds } from '@/components/ui/field';
import { IconCheck, IconImage } from '@/components/ui/icons';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { type FilePurpose, PHOTO_MAX_BYTES, PHOTO_TYPES, uploadFile } from '@/features/file/api';
import { compressPhoto } from '@/features/file/compress';

/** Photo déposée : identifiant du service file, nom affiché, instant du dépôt (purge à 24 h). */
export interface PhotoValue {
  id: string;
  name: string;
  uploadedAt: number;
}

export interface PhotoFieldTexts {
  choose: string;
  replace: string;
  remove: string;
  uploading: string;
  uploaded: (name: string) => string;
  wrongType: string;
  tooLarge: string;
  failed: string;
}

/** Aperçu local de la photo (adresse `blob:`) ; facultatif : sans lui, le nom du fichier suffit. */
function previewOf(file: Blob, fileId: string): { url: string; fileId: string } | null {
  try {
    return { url: URL.createObjectURL(file), fileId };
  } catch {
    return null;
  }
}

/**
 * Une photo (portrait, recto ou verso d'une pièce) : choisie dans la galerie ou prise avec l'appareil,
 * compressée (1600 px, JPEG), puis déposée aussitôt au service file. Seul l'identifiant du fichier part
 * avec le formulaire. Aperçu de la photo choisie tant que la page est ouverte ; ensuite, son nom.
 */
export function PhotoField({
  id,
  label,
  hint,
  purpose,
  value,
  onChange,
  texts: t,
  error,
  disabled,
  previewClassName,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  purpose: FilePurpose;
  value: PhotoValue | null;
  onChange: (value: PhotoValue | null) => void;
  texts: PhotoFieldTexts;
  error?: string | null;
  disabled?: boolean;
  /** Forme de l'aperçu (portrait carré, pièce d'identité en largeur). */
  previewClassName?: string;
}) {
  const ids = fieldIds(id);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; fileId: string } | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!preview) return;
    return () => {
      try {
        URL.revokeObjectURL(preview.url);
      } catch {
        // Navigateur sans adresses locales : rien à libérer.
      }
    };
  }, [preview]);

  async function pick(files: FileList | null) {
    const original = files?.[0];
    if (!original) return;
    setProblem(null);
    setUploading(true);
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    try {
      const file = await compressPhoto(original);
      if (!PHOTO_TYPES.includes(file.type)) throw new Error(t.wrongType);
      if (file.size > PHOTO_MAX_BYTES) throw new Error(t.tooLarge);
      const stored = await uploadFile(file, purpose, current.signal);
      setPreview(previewOf(file, stored.id));
      onChange({ id: stored.id, name: file.name || original.name, uploadedAt: Date.now() });
    } catch (caught) {
      if (current.signal.aborted) return;
      setProblem(caught instanceof ApiError || caught instanceof Error ? caught.message : t.failed);
    } finally {
      if (!current.signal.aborted) setUploading(false);
    }
  }

  // Le refus d'un envoi passe avant l'erreur de l'étape (« Ajoutez une photo »).
  const shown = problem ?? error;
  const image = preview && value && preview.fileId === value.id ? preview.url : null;
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
      <div
        className={cn(
          'rounded-card border-line-strong bg-surface-muted relative grid place-items-center overflow-hidden border border-dashed',
          value && 'border-action bg-action-soft border-solid',
          previewClassName ?? 'aspect-[4/3] w-full max-w-sm',
        )}
      >
        {image ? (
          // Aperçu local (adresse `blob:`) : aucune optimisation d'image à attendre du serveur.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="size-full object-cover" />
        ) : value ? (
          <IconCheck className="text-action-ink size-10" />
        ) : (
          <IconImage className="text-ink-subtle size-10" />
        )}
      </div>
      {value ? (
        <p className="text-action-ink flex items-start gap-2 font-semibold">
          <IconCheck className="mt-0.5 size-5 shrink-0" />
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
          <IconImage className="size-5" />
          {value ? t.replace : t.choose}
          <input
            id={id}
            type="file"
            accept={PHOTO_TYPES.join(',')}
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
