import type { FieldValues, VisitParameter } from '@/features/cleaning/field-schemas';
import { visitTexts } from '@/features/cleaning/visit-texts';

/**
 * Constat d'une visite (`PUT /visits/{id}/observations`) : formulaire généré depuis `parameters` (nombre
 * entier avec unité et bornes, choix, oui/non), prérempli avec le constat déjà saisi, sinon le déclaré du
 * client. Seules les mesures sont saisies : aucun montant (R-EX-04). Un paramètre désactivé n'est plus
 * demandé, une valeur de choix désactivée n'est plus proposée (refusée en saisie, R-CA-06).
 */

const t = visitTexts.observations;

/** Bornes du contrat pour un nombre (`CleaningValues`) : entier de 0 à 1 000 000. */
const MIN = 0;
const MAX = 1_000_000;

/** Saisie : nombre en texte, code de choix, `'true'`/`'false'`, ou vide. */
export type ObservationForm = Record<string, string>;

export function formParameters(parameters: VisitParameter[]): VisitParameter[] {
  return parameters.filter((parameter) => parameter.active);
}

export function activeChoices(parameter: VisitParameter) {
  return parameter.choices.filter((choice) => choice.active);
}

export function bounds(parameter: VisitParameter): { min: number; max: number } {
  return { min: parameter.min ?? MIN, max: parameter.max ?? MAX };
}

/** Saisie de départ : constat déjà saisi, sinon déclaré du client (valeurs encore acceptées seulement). */
export function initialForm(parameters: VisitParameter[], values: FieldValues | null): ObservationForm {
  const form: ObservationForm = {};
  for (const parameter of formParameters(parameters)) {
    const value = values?.[parameter.code];
    let text = '';
    if (parameter.kind === 'number' && typeof value === 'number') text = String(value);
    else if (parameter.kind === 'boolean' && typeof value === 'boolean') text = String(value);
    else if (
      parameter.kind === 'choice' &&
      typeof value === 'string' &&
      activeChoices(parameter).some((choice) => choice.code === value)
    )
      text = value;
    form[parameter.code] = text;
  }
  return form;
}

/** Valeurs à envoyer, ou les erreurs par paramètre (message près du champ). */
export function readForm(
  parameters: VisitParameter[],
  form: ObservationForm,
): { values: FieldValues; errors: Record<string, string> } {
  const values: FieldValues = {};
  const errors: Record<string, string> = {};
  for (const parameter of formParameters(parameters)) {
    const raw = (form[parameter.code] ?? '').trim();
    if (!raw) {
      if (parameter.required) errors[parameter.code] = t.missingValue;
      continue;
    }
    if (parameter.kind === 'number') {
      if (!/^\d+$/.test(raw)) {
        errors[parameter.code] = t.notInteger;
        continue;
      }
      const value = Number(raw);
      const { min, max } = bounds(parameter);
      if (value < min || value > max) {
        errors[parameter.code] = t.range(min, max);
        continue;
      }
      values[parameter.code] = value;
    } else if (parameter.kind === 'boolean') {
      values[parameter.code] = raw === 'true';
    } else if (parameter.kind === 'choice') {
      if (!activeChoices(parameter).some((choice) => choice.code === raw)) {
        errors[parameter.code] = t.missingValue;
        continue;
      }
      values[parameter.code] = raw;
    }
  }
  return { values, errors };
}

/** Valeur lisible d'un constat enregistré (« 120 m² », « Oui », libellé du choix). */
export function displayValue(parameter: VisitParameter, value: FieldValues[string] | undefined): string {
  if (value === undefined) return t.noValue;
  if (typeof value === 'boolean') return value ? t.yes : t.no;
  if (typeof value === 'number')
    return parameter.unit
      ? `${value.toLocaleString('fr-BJ')} ${parameter.unit}`
      : value.toLocaleString('fr-BJ');
  return parameter.choices.find((choice) => choice.code === value)?.label ?? value;
}
