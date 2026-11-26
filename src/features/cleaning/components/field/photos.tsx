'use client';

import { useEffect, useMemo, useState } from 'react';
import { buttonClasses, type ButtonVariant } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { IconCamera, IconImage, IconTrash } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { compressPhoto, PHOTO_MAX_BYTES, PHOTO_TYPES } from '@/features/file';
import type { FieldPhoto } from '@/features/cleaning/field-schemas';
import { fieldTexts } from '@/features/cleaning/field-texts';
import { type Mark, markKey } from '@/features/cleaning/field/overlay';
import { MarkBadge } from './field-ui';

const t = fieldTexts.photos;

/** Nombre maximal de photos par visite, par type de photo d'une séance, et par incident (contrat). */
export const MAX_PHOTOS = 10;

/**
 * Bouton « Prendre une photo » : appareil photo du téléphone (`capture="environment"`), photo compressée
 * (1600 px, JPEG, sans dépendance) puis remise à l'écran, qui la garde dans la file d'attente.
 */
export function PhotoCapture({
  id,
  label,
  onPhoto,
  disabled,
  variant = 'secondary',
  className,
}: {
  id: string;
  label: string;
  onPhoto: (file: File) => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  className?: string;
}) {
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const off = disabled || preparing;

  async function pick(files: FileList | null) {
    const original = files?.[0];
    if (!original) return;
    setProblem(null);
    setPreparing(true);
    try {
      const file = await compressPhoto(original);
      if (!PHOTO_TYPES.includes(file.type)) return setProblem(t.wrongType);
      if (file.size > PHOTO_MAX_BYTES) return setProblem(t.tooLarge);
      onPhoto(file);
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className={cn('grid gap-1', className)}>
      <label
        className={cn(
          // Libellé long (« Prendre une photo « après » ») : il passe à la ligne au lieu de déborder.
          buttonClasses({ variant, size: 'lg', className: 'w-full cursor-pointer py-2 text-center' }).replace(
            'whitespace-nowrap',
            'whitespace-normal',
          ),
          'has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
          off && 'pointer-events-none opacity-50',
        )}
      >
        <IconCamera className="size-6" />
        {preparing ? t.preparing : label}
        <input
          id={id}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={off}
          aria-describedby={problem ? `${id}-erreur` : undefined}
          onChange={(event) => {
            void pick(event.target.files);
            event.target.value = '';
          }}
        />
      </label>
      {problem ? <FieldError id={`${id}-erreur`}>{problem}</FieldError> : null}
    </div>
  );
}

/** Adresses locales (`blob:`) des photos encore sur le téléphone, libérées quand elles partent. */
export function useBlobUrls(blobs: Record<string, Blob>): Record<string, string> {
  const signature = Object.keys(blobs).sort().join('|');
  // `signature` suffit : un même geste garde le même contenu tant qu'il est dans la file.
  const urls = useMemo(() => {
    const next: Record<string, string> = {};
    for (const [key, blob] of Object.entries(blobs)) {
      try {
        next[key] = URL.createObjectURL(blob);
      } catch {
        // Navigateur sans adresses locales : la vignette reste neutre.
      }
    }
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  useEffect(
    () => () => {
      Object.values(urls).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Rien à libérer.
        }
      });
    },
    [urls],
  );
  return urls;
}

/** Vignettes des photos (gateway ou téléphone), avec leur état d'envoi et, au besoin, « Retirer ». */
export function PhotoGrid({
  photos,
  marks,
  local,
  onRemove,
  canRemove,
  label,
}: {
  photos: FieldPhoto[];
  marks: Record<string, Mark>;
  local: Record<string, Blob>;
  onRemove?: (photo: FieldPhoto) => void;
  /** Photo retirable (fiche ni réalisée ni annulée, photo pas en cours d'envoi). */
  canRemove?: (photo: FieldPhoto) => boolean;
  label: string;
}) {
  const previews = useBlobUrls(local);
  const [confirming, setConfirming] = useState<string | null>(null);
  // Lien expiré ou refusé : vignette neutre plutôt qu'une image cassée.
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  if (!photos.length) return <p className="text-ink-muted">{t.empty}</p>;
  return (
    <ul aria-label={label} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((photo, index) => {
        const candidate = photo.url ?? previews[photo.fileId] ?? null;
        const source = candidate && !broken.has(candidate) ? candidate : null;
        const mark = marks[markKey.photo(photo.fileId)];
        const removable = !!onRemove && (canRemove?.(photo) ?? true);
        return (
          <li
            key={photo.fileId}
            className="rounded-control border-line bg-surface-muted relative aspect-square overflow-hidden border"
          >
            {source ? (
              // Lien temporaire du service file ou aperçu local : aucune optimisation d'image à attendre.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={source}
                alt={t.alt(index + 1)}
                className="size-full object-cover"
                onError={() => setBroken((current) => new Set(current).add(source))}
              />
            ) : (
              <span className="text-ink-subtle grid size-full place-items-center" title={t.unavailable}>
                <IconImage className="size-8" />
                <span className="sr-only">{`${t.alt(index + 1)} — ${t.unavailable}`}</span>
              </span>
            )}
            {mark ? <MarkBadge mark={mark} compact className="absolute bottom-1.5 left-1.5" /> : null}
            {removable && confirming !== photo.fileId ? (
              <button
                type="button"
                onClick={() => setConfirming(photo.fileId)}
                className="bg-surface/90 text-ink hover:bg-surface focus-visible:outline-focus absolute top-1 right-1 grid size-11 place-items-center rounded-full shadow-xs focus-visible:outline-2"
              >
                <IconTrash className="size-5" />
                <span className="sr-only">{`${t.remove} ${index + 1}`}</span>
              </button>
            ) : null}
            {confirming === photo.fileId ? (
              <div
                role="group"
                aria-label={t.confirmRemove}
                className="bg-brand-900/90 absolute inset-0 grid content-center gap-1.5 p-1.5 text-center"
              >
                <p className="text-small font-semibold text-white">{t.confirmRemove}</p>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(null);
                    onRemove?.(photo);
                  }}
                  className="text-brand-900 min-h-11 rounded-full bg-white text-sm font-semibold"
                >
                  {t.confirmRemoveYes}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="min-h-11 rounded-full text-sm font-semibold text-white underline underline-offset-4"
                >
                  {t.confirmRemoveNo}
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
