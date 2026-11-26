import { readStored, removeStored, writeStored } from './device-storage';

const NOW = Date.parse('2026-11-26T09:00:00Z');
const DAY = 86_400_000;

beforeEach(() => localStorage.clear());

describe('données gardées sur l’appareil', () => {
  it('rend la valeur jusqu’à son expiration, puis l’efface', () => {
    expect(writeStored('ksp.test', { a: 1 }, 7, NOW)).toBe(true);
    expect(readStored('ksp.test', NOW + 7 * DAY - 1)).toEqual({ a: 1 });
    expect(readStored('ksp.test', NOW + 7 * DAY)).toBeNull();
    expect(localStorage.getItem('ksp.test')).toBeNull();
  });

  it('lit une valeur abîmée comme absente', () => {
    localStorage.setItem('ksp.test', 'pas du JSON');
    expect(readStored('ksp.test', NOW)).toBeNull();
    localStorage.setItem('ksp.test', JSON.stringify({ value: 1 }));
    expect(readStored('ksp.test', NOW)).toBeNull();
    expect(localStorage.getItem('ksp.test')).toBeNull();
  });

  it('efface sur demande', () => {
    writeStored('ksp.test', 'x', 1, NOW);
    removeStored('ksp.test');
    expect(readStored('ksp.test', NOW)).toBeNull();
  });
});
