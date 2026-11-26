/**
 * Semaine type d'un agent (`CleaningAvailabilityRule`, R-DS-01) : plages horaires par jour, heure de
 * Porto-Novo, 6 plages par jour au plus. Partagée par la candidature et l'écran « Disponibilités ».
 * Le front ne vérifie que la saisie (heure lisible, fin après le début) ; la gateway reste juge
 * (chevauchements, plages occupées par une affectation).
 */

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface TimeRange {
  start: string;
  end: string;
}

export type WeeklyPlan = Record<Weekday, TimeRange[]>;

/** Plages par jour au plus (contrat : `ranges`, `maxItems: 6`). */
export const MAX_RANGES_PER_DAY = 6;

/** Plage proposée quand l'agent coche un jour. */
export const DEFAULT_RANGE: TimeRange = { start: '08:00', end: '17:00' };

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function emptyWeek(): WeeklyPlan {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

/** Semaine reçue de la gateway → modèle de l'écran (un jour inconnu est ignoré). */
export function weekFromRules(rules: ReadonlyArray<{ weekday: string; ranges: TimeRange[] }>): WeeklyPlan {
  const plan = emptyWeek();
  for (const rule of rules) {
    if ((WEEKDAYS as ReadonlyArray<string>).includes(rule.weekday)) {
      plan[rule.weekday as Weekday] = rule.ranges.map(({ start, end }) => ({ start, end }));
    }
  }
  return plan;
}

/** Modèle de l'écran → `weekly` du contrat : seuls les jours qui ont des plages, dans l'ordre. */
export function rulesFromWeek(plan: WeeklyPlan): Array<{ weekday: Weekday; ranges: TimeRange[] }> {
  return WEEKDAYS.filter((day) => plan[day].length > 0).map((day) => ({
    weekday: day,
    ranges: plan[day].map(({ start, end }) => ({ start, end })),
  }));
}

export function hasRanges(plan: WeeklyPlan): boolean {
  return WEEKDAYS.some((day) => plan[day].length > 0);
}

export type RangeProblem = 'time' | 'order';

/** Problème de saisie d'une plage : heure illisible, ou fin avant le début. */
export function rangeProblem(range: TimeRange): RangeProblem | null {
  if (!TIME.test(range.start) || !TIME.test(range.end)) return 'time';
  return range.end <= range.start ? 'order' : null;
}

/** Premières plages en défaut, pour placer l'erreur sous la bonne ligne (`mon-0`). */
export function weekProblems(plan: WeeklyPlan): Record<string, RangeProblem> {
  const problems: Record<string, RangeProblem> = {};
  for (const day of WEEKDAYS) {
    plan[day].forEach((range, index) => {
      const problem = rangeProblem(range);
      if (problem) problems[`${day}-${index}`] = problem;
    });
  }
  return problems;
}
