import type { RangeProblem, Weekday } from './weekly';

/** Textes de la semaine type, communs à la candidature et à l'écran « Disponibilités ». */

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: 'Lundi',
  tue: 'Mardi',
  wed: 'Mercredi',
  thu: 'Jeudi',
  fri: 'Vendredi',
  sat: 'Samedi',
  sun: 'Dimanche',
};

export const weeklyTexts = {
  legend: 'Semaine type',
  from: 'De',
  to: 'À',
  addRange: 'Ajouter une plage',
  removeRange: (day: string, index: number) => `Retirer la plage ${index + 1} du ${day.toLowerCase()}`,
  maxRanges: '6 plages au plus ce jour-là.',
  rangeLabel: (day: string, index: number) => `${day}, plage ${index + 1}`,
  problems: {
    time: 'Heure invalide (format 08:00).',
    order: 'L’heure de fin doit suivre l’heure de début.',
  } satisfies Record<RangeProblem, string>,
};
