import { render, screen } from '@testing-library/react';
import { Button, ButtonLink } from './button';

describe('boutons', () => {
  it('ne soumet pas de formulaire par défaut', () => {
    render(<Button>Valider</Button>);
    expect(screen.getByRole('button', { name: 'Valider' })).toHaveAttribute('type', 'button');
  });

  it('applique la variante et garde les classes ajoutées', () => {
    render(
      <Button variant="action" className="mt-4">
        Commencer la séance
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Commencer la séance' });
    expect(button).toHaveClass('bg-action', 'text-on-action', 'min-h-12', 'mt-4');
  });

  it('rend un lien qui a l’apparence d’un bouton', () => {
    render(
      <ButtonLink href="/agent" variant="secondary" size="lg">
        Espace agent
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: 'Espace agent' });
    expect(link).toHaveAttribute('href', '/agent');
    expect(link).toHaveClass('min-h-14', 'border-line-strong');
  });
});
