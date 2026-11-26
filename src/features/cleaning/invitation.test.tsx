import { render, screen } from '@testing-library/react';
import { session } from '@/lib/api';
import { sessionBody } from '@/lib/api/fake-gateway.test-utils';
import { InvitationWelcome } from './components/invitation-welcome';
import {
  forgetInvitation,
  INVITATION_KEY,
  isInvitationId,
  keepInvitation,
  readInvitation,
} from './invitation';
import { agentStatusView } from './texts';

const ID = '0192F1C4-7A2B-7C3D-8E4F-5A6B7C8D9E20';

beforeEach(async () => {
  sessionStorage.clear();
  await session.clear();
});

describe('invitation d’un agent', () => {
  it('reconnaît un identifiant au format du contrat (UUID)', () => {
    expect(isInvitationId(ID)).toBe(true);
    expect(isInvitationId('abc')).toBe(false);
    expect(isInvitationId('../connexion')).toBe(false);
    expect(isInvitationId(null)).toBe(false);
  });

  it('garde l’invitation dans l’onglet jusqu’à la candidature', () => {
    expect(keepInvitation(ID)).toBe(true);
    expect(sessionStorage.getItem(INVITATION_KEY)).toBe(ID.toLowerCase());
    expect(readInvitation()).toBe(ID.toLowerCase());
    forgetInvitation();
    expect(readInvitation()).toBeNull();
  });

  it('refuse un identifiant invalide et ignore une valeur abîmée', () => {
    expect(keepInvitation('pas-un-identifiant')).toBe(false);
    sessionStorage.setItem(INVITATION_KEY, 'abîmée');
    expect(readInvitation()).toBeNull();
  });
});

describe('page d’invitation', () => {
  it('explique la connexion avec le numéro invité et garde l’invitation', async () => {
    render(<InvitationWelcome id={ID} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Vous êtes invité à devenir agent KSP' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Invitation enregistrée sur ce téléphone.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se connecter avec ce numéro' })).toHaveAttribute(
      'href',
      '/candidature',
    );
    expect(readInvitation()).toBe(ID.toLowerCase());
  });

  it('déjà connecté : « Continuer ma candidature »', () => {
    session.set(sessionBody({ profileIncomplete: false }) as Parameters<typeof session.set>[0]);
    render(<InvitationWelcome id={ID} />);
    expect(screen.getByRole('link', { name: 'Continuer ma candidature' })).toHaveAttribute(
      'href',
      '/candidature',
    );
  });

  it('lien abîmé : message clair, rien n’est gardé', () => {
    render(<InvitationWelcome id="abc" />);
    expect(screen.getByRole('heading', { name: 'Lien d’invitation invalide' })).toBeInTheDocument();
    expect(readInvitation()).toBeNull();
  });
});

describe('statut d’un agent', () => {
  it.each([
    ['applicant', 'Candidature envoyée'],
    ['under_review', 'Candidature en cours d’examen'],
    ['active', 'Candidature acceptée'],
    ['suspended', 'Compte agent suspendu'],
    ['deactivated', 'Compte agent désactivé'],
    ['rejected', 'Candidature non retenue'],
    ['nouveau_statut', 'Candidature enregistrée'],
  ])('%s → %s', (status, title) => {
    expect(agentStatusView(status).title).toBe(title);
  });

  it('seule une candidature acceptée propose d’actualiser les accès', () => {
    expect(agentStatusView('active').suggestRefresh).toBe(true);
    expect(agentStatusView('under_review').suggestRefresh).toBeUndefined();
  });
});
