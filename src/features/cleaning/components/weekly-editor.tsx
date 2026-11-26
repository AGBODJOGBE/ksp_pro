'use client';

import { Button } from '@/components/ui/button';
import { FieldError, inputClasses } from '@/components/ui/field';
import { IconClose } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import {
  DEFAULT_RANGE,
  MAX_RANGES_PER_DAY,
  rangeProblem,
  type TimeRange,
  WEEKDAYS,
  type Weekday,
  type WeeklyPlan,
} from '@/features/cleaning/weekly';
import { WEEKDAY_LABEL, weeklyTexts as t } from '@/features/cleaning/weekly-texts';

/** `08:00` + 120 min → `10:00`, sans dépasser `23:59`. */
function later(time: string, minutes: number): string {
  const [hours = 0, rest = 0] = time.split(':').map(Number);
  const total = Math.min(hours * 60 + rest + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Semaine type : un jour coché reçoit une plage (8 h – 17 h, modifiable) ; jusqu'à 6 plages par jour.
 * Champs d'heure natifs (clavier du téléphone), cibles de 48 px. Les plages en défaut sont signalées
 * sous leur ligne quand `showErrors` est vrai (après un essai d'envoi).
 */
export function WeeklyEditor({
  id,
  value,
  onChange,
  showErrors = false,
  disabled = false,
}: {
  id: string;
  value: WeeklyPlan;
  onChange: (next: WeeklyPlan) => void;
  showErrors?: boolean;
  disabled?: boolean;
}) {
  const setDay = (day: Weekday, ranges: TimeRange[]) => onChange({ ...value, [day]: ranges });

  return (
    <ul className="grid gap-3">
      {WEEKDAYS.map((day) => {
        const ranges = value[day];
        const label = WEEKDAY_LABEL[day];
        const on = ranges.length > 0;
        return (
          <li
            key={day}
            className={cn(
              'rounded-card border p-3 sm:p-4',
              on ? 'border-action-muted bg-surface' : 'border-line bg-surface-muted',
            )}
          >
            <label className="flex min-h-12 cursor-pointer items-center gap-3 font-semibold">
              <input
                type="checkbox"
                className="accent-action size-6 shrink-0"
                checked={on}
                disabled={disabled}
                onChange={(event) => setDay(day, event.target.checked ? [{ ...DEFAULT_RANGE }] : [])}
              />
              {label}
            </label>
            {on ? (
              <div className="mt-2 grid gap-3">
                {ranges.map((range, index) => {
                  const problem = showErrors ? rangeProblem(range) : null;
                  const rowId = `${id}-${day}-${index}`;
                  const update = (patch: Partial<TimeRange>) =>
                    setDay(
                      day,
                      ranges.map((item, position) => (position === index ? { ...item, ...patch } : item)),
                    );
                  return (
                    <div key={index} role="group" aria-label={t.rangeLabel(label, index)}>
                      <div className="flex items-end gap-2">
                        <label className="grid min-w-0 flex-1 gap-1">
                          <span className="text-small text-ink-muted">{t.from}</span>
                          <input
                            type="time"
                            value={range.start}
                            disabled={disabled}
                            aria-invalid={problem ? true : undefined}
                            aria-describedby={problem ? `${rowId}-erreur` : undefined}
                            onChange={(event) => update({ start: event.target.value })}
                            className={inputClasses({ invalid: !!problem, className: 'tabular-nums' })}
                          />
                        </label>
                        <label className="grid min-w-0 flex-1 gap-1">
                          <span className="text-small text-ink-muted">{t.to}</span>
                          <input
                            type="time"
                            value={range.end}
                            disabled={disabled}
                            aria-invalid={problem ? true : undefined}
                            aria-describedby={problem ? `${rowId}-erreur` : undefined}
                            onChange={(event) => update({ end: event.target.value })}
                            className={inputClasses({ invalid: !!problem, className: 'tabular-nums' })}
                          />
                        </label>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t.removeRange(label, index)}
                          disabled={disabled}
                          onClick={() =>
                            setDay(
                              day,
                              ranges.filter((_, position) => position !== index),
                            )
                          }
                        >
                          <IconClose className="size-5" />
                        </Button>
                      </div>
                      {problem ? <FieldError id={`${rowId}-erreur`}>{t.problems[problem]}</FieldError> : null}
                    </div>
                  );
                })}
                {ranges.length < MAX_RANGES_PER_DAY ? (
                  <Button
                    variant="secondary"
                    className="justify-self-start"
                    disabled={disabled}
                    onClick={() => {
                      // Nouvelle plage de 2 heures après la dernière (17:00 – 19:00), à ajuster.
                      const start = ranges[ranges.length - 1]?.end ?? DEFAULT_RANGE.start;
                      setDay(day, [...ranges, { start, end: later(start, 120) }]);
                    }}
                  >
                    {t.addRange}
                  </Button>
                ) : (
                  <p className="text-small text-ink-muted">{t.maxRanges}</p>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
