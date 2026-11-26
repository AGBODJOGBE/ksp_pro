import { spaceLabel } from './navigation';

describe('nom de l’espace dans l’en-tête', () => {
  it.each([
    ['/', 'Espace pro'],
    ['/agent', 'Espace agent'],
    ['/agent/seance', 'Espace agent'],
    ['/partenaire', 'Espace partenaire'],
    ['/candidature', 'Candidature'],
    ['/agents', 'Espace pro'],
    ['/connexion', 'Espace pro'],
  ])('%s → %s', (path, label) => {
    expect(spaceLabel(path)).toBe(label);
  });
});
