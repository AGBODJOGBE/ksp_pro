import { loginHref, safeReturnPath } from './return-path';

describe('retour après la connexion', () => {
  it.each([
    ['/agent', '/agent'],
    ['/agent/seance?id=12#photos', '/agent/seance?id=12#photos'],
    ['/candidature', '/candidature'],
  ])('garde un chemin interne (%s)', (value, expected) => {
    expect(safeReturnPath(value)).toBe(expected);
  });

  it.each([
    null,
    '',
    'agent',
    'https://autre-site.example/piege',
    '//autre-site.example',
    '/\\autre-site.example',
    '/\t/autre-site.example',
    'javascript:alert(1)',
    '/connexion',
    '/connexion?retour=/agent',
  ])('refuse tout le reste et revient au choix de l’espace (%s)', (value) => {
    expect(safeReturnPath(value)).toBe('/');
  });

  it('construit l’adresse de connexion avec le retour encodé', () => {
    expect(loginHref('/agent/seance?id=12')).toBe('/connexion?retour=%2Fagent%2Fseance%3Fid%3D12');
    expect(loginHref('https://autre-site.example')).toBe('/connexion?retour=%2F');
  });
});
