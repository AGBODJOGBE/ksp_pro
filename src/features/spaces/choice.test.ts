import { grantsFromAccessToken } from '@/lib/api';
import { accessToken } from '@/lib/api/access-token.test-utils';
import { chooseSpace, hasSpace, spacesOf } from './choice';

const AGENT_PERMS = ['cleaning.session.perform', 'cleaning.visit.perform'];
const grants = (roles: string[], perms?: string[]) => grantsFromAccessToken(accessToken(roles, perms));

describe('choix de l’espace d’après le jeton', () => {
  it('agent : permission de terrain du Nettoyage dans perms (rôles web : customer seulement)', () => {
    expect(chooseSpace(grants(['customer'], AGENT_PERMS))).toEqual({ kind: 'open', space: 'agent' });
  });

  it.each(['recovery_bailiff', 'recovery_lawyer'])('partenaire : rôle %s', (role) => {
    expect(chooseSpace(grants([role], []))).toEqual({ kind: 'open', space: 'partner' });
  });

  it('partenaire : permission partenaire (correction attendue du back, B1)', () => {
    expect(spacesOf(grants(['customer'], ['recovery.assignment.perform']))).toEqual(['partner']);
  });

  it('les deux : deux cartes, agent d’abord', () => {
    const both = grants(['customer', 'recovery_lawyer'], AGENT_PERMS);
    expect(chooseSpace(both)).toEqual({ kind: 'both' });
    expect(spacesOf(both)).toEqual(['agent', 'partner']);
  });

  it('aucun : on demande au Nettoyage si le compte a candidaté', () => {
    expect(chooseSpace(grants(['customer'], []))).toEqual({ kind: 'check-application' });
    // Jeton sans perms (émis avant ADR-057) : aucune permission de terrain.
    expect(chooseSpace(grants(['customer']))).toEqual({ kind: 'check-application' });
  });

  it('la visite seule ne suffit pas : l’espace agent demande la permission des séances', () => {
    expect(hasSpace(grants(['customer'], ['cleaning.visit.perform']), 'agent')).toBe(false);
  });

  it('un rôle du Nettoyage dans roles n’ouvre rien sans la permission', () => {
    expect(hasSpace(grants(['cleaning_agent'], []), 'agent')).toBe(false);
  });

  it('jeton illisible : aucun espace', () => {
    expect(spacesOf(grantsFromAccessToken('a.%%%.b'))).toEqual([]);
  });
});
