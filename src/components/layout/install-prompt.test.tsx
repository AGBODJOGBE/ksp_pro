import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fr } from '@/i18n/fr';
import { InstallPrompt } from './install-prompt';

function installEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

const userAgent = navigator.userAgent;
function setUserAgent(value: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = vi.fn(() => ({ matches: false }) as unknown as MediaQueryList);
});

afterEach(() => setUserAgent(userAgent));

describe('incitation à installer KSP Pro', () => {
  it('rien tant que le navigateur ne propose pas l’installation', () => {
    render(<InstallPrompt texts={fr.install} />);
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('propose l’installation, puis lance la fenêtre du navigateur', async () => {
    render(<InstallPrompt texts={fr.install} />);
    const event = installEvent();
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('complementary', { name: 'Installer KSP Pro' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter à l’écran d’accueil' }));
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull());
    expect(event.prompt).toHaveBeenCalled();
  });

  it('« Plus tard » est mémorisé : plus d’incitation pendant 30 jours', () => {
    const { unmount } = render(<InstallPrompt texts={fr.install} />);
    act(() => {
      window.dispatchEvent(installEvent());
    });
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    unmount();

    render(<InstallPrompt texts={fr.install} />);
    act(() => {
      window.dispatchEvent(installEvent());
    });
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('sur iPhone, explique le geste « Partager » puis « Sur l’écran d’accueil »', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1');
    render(<InstallPrompt texts={fr.install} />);
    expect(screen.getByText(/touchez Partager, puis « Sur l’écran d’accueil »/)).toBeInTheDocument();
  });

  it('jamais dans l’application déjà installée', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1');
    window.matchMedia = vi.fn(() => ({ matches: true }) as unknown as MediaQueryList);
    render(<InstallPrompt texts={fr.install} />);
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});
