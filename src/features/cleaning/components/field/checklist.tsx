'use client';

import { IconCheck } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import type { ChecklistItem } from '@/features/cleaning/field-schemas';
import { sessionTexts } from '@/features/cleaning/session-texts';
import { type Mark, markKey } from '@/features/cleaning/field/overlay';
import { MarkBadge } from './field-ui';

const t = sessionTexts;

/**
 * Liste de contrôle d'une séance : chaque point se coche dès qu'il est fait, par tout membre de l'équipe
 * (une ligne entière de 56 px, case native). Chaque case part seule dans la file, avec son heure réelle.
 */
export function Checklist({
  items,
  marks,
  disabled,
  onToggle,
}: {
  items: ChecklistItem[];
  marks: Record<string, Mark>;
  disabled?: boolean;
  onToggle: (item: ChecklistItem, checked: boolean) => void;
}) {
  if (!items.length) return <p className="text-ink-muted">{t.checklistEmpty}</p>;
  const done = items.filter((item) => item.checked).length;
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label={t.checklistTitle}
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done}
          className="bg-surface-sunken h-2 flex-1 overflow-hidden rounded-full"
        >
          <div
            className="bg-action ease-soft h-full rounded-full transition-[width] duration-(--motion-base)"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
        <p className="text-small text-ink-muted shrink-0 font-semibold tabular-nums">
          {t.checklistProgress(done, items.length)}
        </p>
      </div>
      <ul className="grid gap-2">
        {items.map((item) => {
          const key = markKey.check(item.code, item.cleaningTypeCode);
          const id = `point-${item.cleaningTypeCode ?? 'commun'}-${item.code}`;
          return (
            <li key={key}>
              <label
                htmlFor={id}
                className={cn(
                  'rounded-control border-line-control bg-surface flex min-h-14 cursor-pointer items-center gap-3 border px-4 py-2',
                  'has-[:checked]:border-action has-[:checked]:bg-action-soft',
                  'has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <input
                  id={id}
                  type="checkbox"
                  className="peer sr-only"
                  checked={item.checked}
                  disabled={disabled}
                  onChange={(event) => onToggle(item, event.target.checked)}
                />
                <span
                  aria-hidden="true"
                  className="border-line-strong text-on-action peer-checked:border-action peer-checked:bg-action grid size-7 shrink-0 place-items-center rounded-md border-2"
                >
                  {item.checked ? <IconCheck className="size-5" /> : null}
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-ink font-medium">{item.label}</span>
                  <MarkBadge mark={marks[key]} className="justify-self-start" />
                  {item.checked && item.checkedAt ? (
                    <span className="text-small text-ink-muted">{formatTime(item.checkedAt)}</span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
