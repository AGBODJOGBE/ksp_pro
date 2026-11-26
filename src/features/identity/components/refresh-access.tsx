'use client';

import { useState } from 'react';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { IconRefresh } from '@/components/ui/icons';
import { getDictionary } from '@/i18n';
import { cn } from '@/lib/cn';
import { refreshAccess } from '@/features/identity/access';

/**
 * Bouton « Actualiser mes accès » : renouvelle le jeton pour qu'un rôle donné récemment (candidature
 * validée, accès partenaire) prenne effet. La session mise à jour redessine les écrans qui la lisent.
 */
export function RefreshAccessButton({
  variant = 'secondary',
  className,
}: {
  variant?: ButtonVariant;
  className?: string;
}) {
  const t = getDictionary();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function refresh() {
    if (pending) return;
    setPending(true);
    setMessage(null);
    const result = await refreshAccess();
    setPending(false);
    if (result.status === 'refreshed') setMessage({ tone: 'success', text: t.account.accessRefreshed });
    else if (result.status === 'unavailable')
      setMessage({ tone: 'error', text: `${t.account.accessRefreshFailed} ${result.message}` });
    // `signed-out` : la session est vide, la garde de la page propose de se reconnecter.
  }

  return (
    <div className={cn('grid gap-3', className)}>
      <Button variant={variant} onClick={refresh} aria-busy={pending || undefined} className="w-full">
        <IconRefresh className={cn(pending && 'motion-safe:animate-spin')} />
        {pending ? t.account.refreshingAccess : t.account.refreshAccess}
      </Button>
      <FormMessage tone={message?.tone === 'success' ? 'success' : 'error'}>{message?.text}</FormMessage>
    </div>
  );
}
