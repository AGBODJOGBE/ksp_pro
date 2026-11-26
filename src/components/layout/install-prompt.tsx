'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { IconClose, IconInstall, IconShare } from '@/components/ui/icons';

/** Événement `beforeinstallprompt` (Chrome, Edge, Samsung Internet), absent des types du DOM. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Refus mémorisé sur cet appareil (confort seulement : rien ne casse sans stockage). */
const DISMISS_KEY = 'ksp-pro.installation.refusee';
const DISMISS_DAYS = 30;

function dismissedRecently(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && now - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function rememberDismiss(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Stockage bloqué : l'incitation reviendra à la prochaine visite.
  }
}

/** Application déjà ouverte depuis l'écran d'accueil. */
function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

/** iPhone ou iPad (Safari n'a pas `beforeinstallprompt` : on explique le geste). */
function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

const noSubscription = () => () => {};
/** Aide pour iOS : appareil Apple, hors application installée, sans refus récent. */
const iosHelpSnapshot = () => isIos() && !isStandalone() && !dismissedRecently();

export interface InstallTexts {
  title: string;
  text: string;
  action: string;
  dismiss: string;
  iosText: string;
}

/**
 * Incitation discrète « Ajouter à l'écran d'accueil » : bandeau refermable sous l'en-tête. Proposé quand
 * le navigateur le permet (`beforeinstallprompt`), ou avec le geste à faire sur iPhone. Jamais dans
 * l'application déjà installée, ni pendant 30 jours après « Plus tard ».
 */
export function InstallPrompt({ texts }: { texts: InstallTexts }) {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);
  const iosHelp = useSyncExternalStore(noSubscription, iosHelpSnapshot, () => false);

  useEffect(() => {
    const onPrompt = (prompt: Event) => {
      prompt.preventDefault();
      if (!dismissedRecently() && !isStandalone()) setEvent(prompt as InstallPromptEvent);
    };
    const onInstalled = () => setClosed(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (closed || (!event && !iosHelp)) return null;

  function dismiss() {
    rememberDismiss();
    setClosed(true);
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice.catch(() => null);
    if (choice?.outcome !== 'accepted') rememberDismiss();
    setClosed(true);
  }

  return (
    <aside
      aria-labelledby="installation-titre"
      className="border-line bg-surface mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-2xl items-start gap-3 rounded-2xl border p-3 shadow-sm"
    >
      <span
        aria-hidden="true"
        className="bg-accent text-on-accent grid size-11 shrink-0 place-items-center rounded-xl"
      >
        <IconInstall className="size-6" />
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <p id="installation-titre" className="text-ink font-bold">
          {texts.title}
        </p>
        {event ? (
          <>
            <p className="text-small text-ink-muted">{texts.text}</p>
            <Button variant="primary" onClick={install} className="mt-1 justify-self-start">
              {texts.action}
            </Button>
          </>
        ) : (
          <p className="text-small text-ink-muted flex items-start gap-1.5">
            <IconShare className="text-ink mt-0.5 size-4" />
            {texts.iosText}
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={dismiss} aria-label={texts.dismiss} className="-m-1">
        <IconClose />
      </Button>
    </aside>
  );
}
