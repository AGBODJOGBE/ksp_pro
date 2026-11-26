import { render, screen } from '@testing-library/react';
import { session } from '@/lib/api';
import { AGENT_PERMS, sessionBody } from '@/lib/api/fake-gateway.test-utils';
import { SpaceGate } from './space-gate';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

beforeEach(async () => {
  await session.clear();
});

function renderGate(space: 'agent' | 'partner', body: ReturnType<typeof sessionBody>) {
  session.set(body as Parameters<typeof session.set>[0]);
  render(
    <SpaceGate space={space}>
      <p>Écran de l’espace</p>
    </SpaceGate>,
  );
}

describe('garde d’un espace', () => {
  it('ouvre l’espace quand le jeton en donne le droit', () => {
    renderGate('agent', sessionBody({ profileIncomplete: false, perms: AGENT_PERMS }));
    expect(screen.getByText('Écran de l’espace')).toBeInTheDocument();
  });

  it('sans le droit : message clair, actualiser les accès, retour aux espaces', () => {
    renderGate('partner', sessionBody({ profileIncomplete: false, perms: AGENT_PERMS }));
    expect(screen.queryByText('Écran de l’espace')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Espace partenaire non disponible' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualiser mes accès' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour à mes espaces' })).toHaveAttribute('href', '/');
  });
});
