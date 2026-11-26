import { Button, ButtonArrow } from '@/components/ui/button';
import { IconArrowLeft, IconArrowRight } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

/*
 * Assistant à étapes (recopié du portail, F-003, et adapté au terrain) : « Étape n sur N » avec une barre
 * de progression, puis « Retour » et « Continuer » fixés en bas de l'écran du téléphone, sous le pouce.
 * Les textes viennent de la fonctionnalité.
 */

/** « Étape 3 sur 11 · Pièce d'identité » et la barre de progression. */
export function WizardProgress({
  steps,
  index,
  progressLabel,
}: {
  /** Noms des étapes, dans l'ordre. */
  steps: ReadonlyArray<string>;
  /** Rang de l'étape en cours (0 pour la première). */
  index: number;
  /** « Étape 2 sur 7 ». */
  progressLabel: string;
}) {
  const percent = Math.round(((index + 1) / Math.max(steps.length, 1)) * 100);
  return (
    <div className="grid gap-2">
      <p className="text-small text-ink-muted font-semibold">
        {progressLabel}
        <span className="text-ink">{` · ${steps[index] ?? ''}`}</span>
      </p>
      <div
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={index + 1}
        aria-valuetext={`${progressLabel} : ${steps[index] ?? ''}`}
        className="bg-line h-2 overflow-hidden rounded-full"
      >
        <span
          aria-hidden="true"
          className="bg-action ease-soft block h-full rounded-full transition-[width] duration-(--motion-slow)"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** « Retour » et « Continuer » (ou l'envoi), fixés en bas de l'écran du téléphone. */
export function WizardNav({
  showBack,
  busy,
  backLabel,
  nextLabel,
  arrow = true,
  nextDisabled = false,
  onBack,
  onNext,
  className,
}: {
  showBack: boolean;
  busy: boolean;
  backLabel: string;
  nextLabel: string;
  /** Flèche du bouton principal (pas sur l'envoi). */
  arrow?: boolean;
  /** Bouton principal indisponible (envoi bloqué, expliqué à côté). */
  nextDisabled?: boolean;
  onBack: () => void;
  onNext: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-line bg-surface/95 pb-safe sticky bottom-0 z-30 -mx-4 mt-8 flex items-center justify-between gap-3 border-t px-4 pt-3 backdrop-blur',
        'sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none',
        className,
      )}
    >
      {showBack ? (
        // Sur téléphone, « Retour » se réduit à sa flèche (48 px, nom accessible gardé) : le bouton
        // principal garde la place de son libellé (« Envoyer ma candidature »).
        <Button variant="secondary" onClick={onBack} disabled={busy} className="max-sm:size-12 max-sm:px-0">
          <IconArrowLeft />
          <span className="max-sm:sr-only">{backLabel}</span>
        </Button>
      ) : (
        <span />
      )}
      <Button
        variant="action"
        size="lg"
        onClick={onNext}
        disabled={busy || nextDisabled}
        aria-busy={busy || undefined}
        className="min-w-0 flex-1 sm:flex-none"
      >
        <span className="truncate">{nextLabel}</span>
        {arrow ? (
          <ButtonArrow>
            <IconArrowRight />
          </ButtonArrow>
        ) : null}
      </Button>
    </div>
  );
}
