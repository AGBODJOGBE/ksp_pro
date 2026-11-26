'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClasses } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Panel, SummaryRow } from '@/components/ui/form-fields';
import { Heading } from '@/components/ui/heading';
import { IconArrowUpRight, IconLogout } from '@/components/ui/icons';
import { navigation } from '@/config/navigation';
import { siteConfig } from '@/config/site';
import { getDictionary } from '@/i18n';
import { useSession } from '@/lib/api';
import { listEntries } from '@/lib/offline/outbox';
import { formatPhone } from '@/lib/phone';
import { RefreshAccessButton, signOut } from '@/features/identity';
import { NotificationPreferences } from '@/features/notification';
import { accountTexts as t } from '@/features/recovery/account-texts';

/**
 * Profil du compte, tel que la session le porte (connexion et renouvellement : nom, numéro, e-mail vérifié) ;
 * la modification se fait sur le portail.
 */
function Profile() {
  const current = useSession();
  if (!current) return null;
  const { user } = current;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return (
    <div className="grid gap-4">
      <dl>
        {name ? <SummaryRow label={t.name}>{name}</SummaryRow> : null}
        {user.phone ? <SummaryRow label={t.phone}>{formatPhone(user.phone)}</SummaryRow> : null}
        <SummaryRow label={t.email}>
          {user.email && user.emailVerified ? (
            <span className="break-all">{user.email}</span>
          ) : (
            <span className="text-ink-muted font-normal">{t.noEmail}</span>
          )}
        </SummaryRow>
      </dl>
      <p className="text-small text-ink-muted">{t.editHint}</p>
      <a
        href={siteConfig.portailUrl}
        className={buttonClasses({ variant: 'secondary', className: 'justify-self-start' })}
      >
        {t.openPortail}
        <IconArrowUpRight />
      </a>
    </div>
  );
}

/**
 * « Se déconnecter » : comme le menu du compte, la déconnexion efface les données du compte sur l'appareil,
 * y compris les actions de terrain d'un agent pas encore envoyées (même compte, F-022) : s'il en reste, elle
 * le dit et demande une confirmation.
 */
function SignOut() {
  const common = getDictionary().account;
  const current = useSession();
  const { replace } = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsent, setUnsent] = useState(0);

  async function leave(confirmed = false) {
    if (pending || !current) return;
    setPending(true);
    setError(null);
    const waiting = confirmed ? 0 : (await listEntries(current.user.id)).length;
    if (waiting > 0) {
      setUnsent(waiting);
      setPending(false);
      return;
    }
    setUnsent(0);
    const result = await signOut();
    setPending(false);
    if (!result.ok) return setError(result.message);
    replace(navigation.login.href);
  }

  return (
    <div className="grid gap-2">
      {unsent ? (
        <div role="alert" className="rounded-control border-warning bg-warning-soft grid gap-2 border p-3">
          <p className="text-ink text-small font-semibold">{common.unsent(unsent)}</p>
          <Button variant="primary" onClick={() => leave(true)} aria-busy={pending || undefined}>
            {common.signOutAnyway}
          </Button>
          <Button variant="ghost" onClick={() => setUnsent(0)}>
            {common.stay}
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => leave()}
          aria-busy={pending || undefined}
          className="w-full"
        >
          <IconLogout />
          {pending ? common.signingOut : common.signOut}
        </Button>
      )}
      <FormMessage>{error}</FormMessage>
    </div>
  );
}

/**
 * « Compte » de l'espace partenaire : profil (celui de la session ; la modification se fait sur le portail),
 * préférences de notification (WhatsApp, e-mail), « Actualiser mes accès » et « Se déconnecter ».
 */
export function PartnerAccount() {
  return (
    <div className="grid gap-6">
      <Heading as="h1" size="h2">
        {t.title}
      </Heading>
      <Panel id="profil-titre" title={t.profileTitle}>
        <Profile />
      </Panel>
      <NotificationPreferences />
      <Panel id="session-titre" title={t.accessTitle}>
        <p className="text-ink-muted">{t.accessText}</p>
        <div className="mt-4 grid gap-3 sm:max-w-sm">
          <RefreshAccessButton />
          <SignOut />
        </div>
      </Panel>
    </div>
  );
}
