import { emptyWeek, hasRanges, rangeProblem, rulesFromWeek, weekFromRules, weekProblems } from './weekly';

describe('semaine type', () => {
  it('passe du contrat à l’écran et retour, jours vides omis', () => {
    const rules = [
      {
        weekday: 'wed',
        ranges: [
          { start: '08:00', end: '12:00' },
          { start: '14:00', end: '18:00' },
        ],
      },
      { weekday: 'mon', ranges: [{ start: '08:00', end: '17:00' }] },
      { weekday: 'holiday', ranges: [{ start: '08:00', end: '09:00' }] },
    ];
    const plan = weekFromRules(rules);
    expect(plan.tue).toEqual([]);
    expect(hasRanges(plan)).toBe(true);
    expect(rulesFromWeek(plan)).toEqual([
      { weekday: 'mon', ranges: [{ start: '08:00', end: '17:00' }] },
      {
        weekday: 'wed',
        ranges: [
          { start: '08:00', end: '12:00' },
          { start: '14:00', end: '18:00' },
        ],
      },
    ]);
    expect(hasRanges(emptyWeek())).toBe(false);
  });

  it('signale une heure illisible ou une fin avant le début', () => {
    expect(rangeProblem({ start: '08:00', end: '17:00' })).toBeNull();
    expect(rangeProblem({ start: '8h', end: '17:00' })).toBe('time');
    expect(rangeProblem({ start: '17:00', end: '17:00' })).toBe('order');
    expect(
      weekProblems({
        ...emptyWeek(),
        fri: [
          { start: '08:00', end: '09:00' },
          { start: '10:00', end: '09:00' },
        ],
      }),
    ).toEqual({
      'fri-1': 'order',
    });
  });
});
