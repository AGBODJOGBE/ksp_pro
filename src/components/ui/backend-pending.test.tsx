import { render, screen } from '@testing-library/react';
import { type BackendNeed, BackendPending } from './backend-pending';

const NEEDS: BackendNeed[] = [
  {
    method: 'GET',
    path: '/api/v1/billing/preferences',
    purpose: 'Lire le réglage du prélèvement automatique des factures sur le portefeuille.',
  },
  {
    method: 'PATCH',
    path: '/api/v1/billing/preferences',
    purpose: 'Activer ou couper le prélèvement automatique (administrateur de l’entreprise).',
  },
];

function Pending() {
  return (
    <BackendPending id="preferences" title="Préférences de facturation" needs={NEEDS}>
      Vous pourrez bientôt faire régler vos factures automatiquement par le portefeuille de l’entreprise.
    </BackendPending>
  );
}

afterEach(() => vi.unstubAllEnvs());

describe('section en attente du backend', () => {
  it('dit « Bientôt disponible » au client et, hors production, ce que le back doit fournir', () => {
    render(<Pending />);
    const section = screen.getByRole('region', { name: 'Préférences de facturation' });
    expect(section).toHaveTextContent('Bientôt disponible');
    expect(section).toHaveTextContent(
      'Vous pourrez bientôt faire régler vos factures automatiquement par le portefeuille de l’entreprise.',
    );
    expect(screen.getByText('Ce que le back doit fournir')).toBeInTheDocument();
    const routes = screen.getAllByRole('listitem');
    expect(routes).toHaveLength(2);
    expect(routes[0]).toHaveTextContent('GET /api/v1/billing/preferences');
    expect(routes[0]).toHaveTextContent(
      'Lire le réglage du prélèvement automatique des factures sur le portefeuille.',
    );
    expect(routes[1]).toHaveTextContent('PATCH /api/v1/billing/preferences');
  });

  it('en production, aucune route ni aucun détail technique n’est affiché', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { container } = render(<Pending />);
    const section = screen.getByRole('region', { name: 'Préférences de facturation' });
    expect(section).toHaveTextContent('Bientôt disponible');
    expect(section).toHaveTextContent(
      'Vous pourrez bientôt faire régler vos factures automatiquement par le portefeuille de l’entreprise.',
    );
    expect(screen.queryByText('Ce que le back doit fournir')).toBeNull();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(container.querySelector('[data-backend-needs]')).toBeNull();
    expect(container.textContent).not.toMatch(/\/api\/|GET|PATCH/);
  });
});
