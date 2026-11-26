'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { IconLogout, IconUser } from '@/components/ui/icons';
import { navigation } from '@/config/navigation';
import { getDictionary } from '@/i18n';
import { useSession } from '@/lib/api';
import { formatPhone } from '@/lib/phone';
import { signOut } from '@/features/identity/access';
import { RefreshAccessButton } from './refresh-access';

const MENU_ID = 'menu-compte';

/**
 * Menu du compte dans l'en-tête (panneau `popover` natif : Échap et clic à l'extérieur le ferment) : nom
 * et numéro, « Actualiser mes accès », « Se déconnecter ». Rien tant qu'aucune session n'est ouverte.
 */
export function AccountMenu() {
  const t = getDictionary();
  const current = useSession();
  const { replace } = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!current) return null;
  const { firstName, lastName, phone } = current.user;
  const name = [firstName, lastName].filter(Boolean).join(' ');

  async function leave() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await signOut();
    setPending(false);
    if (!result.ok) return setError(result.message);
    document.getElementById(MENU_ID)?.hidePopover?.();
    replace(navigation.login.href);
  }

  return (
    <>
      <button
        type="button"
        popoverTarget={MENU_ID}
        aria-label={firstName ? `${t.header.accountMenu} : ${firstName}` : t.header.accountMenu}
        className="text-ink hover:bg-brand-soft focus-visible:outline-focus inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full px-3 font-semibold"
      >
        <span className="bg-accent text-on-accent grid size-8 place-items-center rounded-full">
          <IconUser className="size-5" />
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{firstName ?? t.header.accountMenu}</span>
      </button>
      <div
        id={MENU_ID}
        popover="auto"
        data-tone="light"
        className="popover-panel rounded-card border-line bg-surface shadow-raised fixed inset-auto top-[calc(var(--header-h)+0.5rem)] right-[max(0.75rem,calc((100vw-42rem)/2+0.75rem))] m-0 w-[min(22rem,calc(100vw-1.5rem))] border p-4"
      >
        <p className="font-display text-ink text-lg font-bold">{name || t.header.accountMenu}</p>
        {phone ? (
          <p className="text-ink-muted mt-0.5">
            <span className="sr-only">{t.account.phone} : </span>
            <span className="tabular-nums">{formatPhone(phone)}</span>
          </p>
        ) : null}
        <div className="border-line mt-4 grid gap-2 border-t pt-4">
          <RefreshAccessButton />
          <Button variant="ghost" onClick={leave} aria-busy={pending || undefined} className="w-full">
            <IconLogout />
            {pending ? t.account.signingOut : t.account.signOut}
          </Button>
          <FormMessage>{error}</FormMessage>
        </div>
      </div>
    </>
  );
}
