'use client';

import { type FormEvent, useState } from 'react';
import { TextField } from '@/components/ui/field';
import { ChoicePill, Fieldset, TextAreaField } from '@/components/ui/form-fields';
import type { AgentVisit, FieldValues } from '@/features/cleaning/field-schemas';
import { visitTexts } from '@/features/cleaning/visit-texts';
import {
  activeChoices,
  bounds,
  formParameters,
  initialForm,
  type ObservationForm as FormState,
  readForm,
} from '@/features/cleaning/field/observations';

const t = visitTexts.observations;
const NOTE_MAX = 1000;

/**
 * Formulaire du constat, généré depuis les paramètres de la visite. Envoyé par le bouton principal de la
 * fiche (`form="<id>"`, barre du bas). Le premier champ en erreur reçoit le focus.
 */
export function ObservationForm({
  id,
  visit,
  disabled,
  onSubmit,
}: {
  id: string;
  visit: AgentVisit;
  disabled?: boolean;
  onSubmit: (input: { values: FieldValues; note: string }) => void;
}) {
  const parameters = formParameters(visit.parameters);
  const [form, setForm] = useState<FormState>(() =>
    initialForm(visit.parameters, visit.observedValues ?? visit.declaredValues),
  );
  const [note, setNote] = useState(visit.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (code: string, value: string) => {
    setForm((current) => ({ ...current, [code]: value }));
    setErrors((current) => {
      if (!current[code]) return current;
      const next = { ...current };
      delete next[code];
      return next;
    });
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const result = readForm(visit.parameters, form);
    setErrors(result.errors);
    const first = parameters.find((parameter) => result.errors[parameter.code]);
    if (first) {
      document.getElementById(`${id}-${first.code}`)?.focus();
      return;
    }
    onSubmit({ values: result.values, note: note.trim() });
  }

  return (
    <form id={id} noValidate onSubmit={submit} className="grid gap-5">
      <p className="text-ink-muted">{t.lead}</p>
      {parameters.length ? null : <p className="text-ink-muted">{t.empty}</p>}
      {parameters.map((parameter) => {
        const fieldId = `${id}-${parameter.code}`;
        const error = errors[parameter.code] ?? null;
        const legend = (
          <>
            {parameter.label}
            {parameter.required ? null : <span className="text-ink-muted font-normal"> ({t.optional})</span>}
          </>
        );
        if (parameter.kind === 'number') {
          const { min, max } = bounds(parameter);
          return (
            <TextField
              key={parameter.code}
              id={fieldId}
              label={
                <>
                  {legend}
                  {parameter.unit ? (
                    <span className="text-ink-muted font-normal"> ({parameter.unit})</span>
                  ) : null}
                </>
              }
              hint={[parameter.help, t.rangeHint(min, max, parameter.unit)].filter(Boolean).join(' ')}
              error={error}
              inputMode="numeric"
              autoComplete="off"
              value={form[parameter.code] ?? ''}
              onChange={(event) => set(parameter.code, event.target.value.replace(/\s/g, ''))}
              disabled={disabled}
              inputClassName="text-lg tabular-nums"
            />
          );
        }
        const options =
          parameter.kind === 'boolean'
            ? [
                { code: 'true', label: t.yes },
                { code: 'false', label: t.no },
              ]
            : activeChoices(parameter);
        return (
          <Fieldset key={parameter.code} id={fieldId} legend={legend} hint={parameter.help} error={error}>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((option, index) => (
                <ChoicePill
                  key={option.code}
                  id={index === 0 ? fieldId : undefined}
                  name={fieldId}
                  value={option.code}
                  label={option.label}
                  checked={form[parameter.code] === option.code}
                  onChange={() => set(parameter.code, option.code)}
                  disabled={disabled}
                />
              ))}
            </div>
          </Fieldset>
        );
      })}
      <TextAreaField
        id={`${id}-note`}
        label={t.note}
        hint={t.noteHint}
        value={note}
        maxLength={NOTE_MAX}
        counter={t.noteCounter(note.length)}
        onChange={(event) => setNote(event.target.value)}
        disabled={disabled}
        rows={3}
      />
    </form>
  );
}
