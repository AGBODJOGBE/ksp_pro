import { buttonClasses } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { IconArrowUpRight } from '@/components/ui/icons';
import { siteConfig } from '@/config/site';
import { getDictionary } from '@/i18n';

/**
 * Compte en cours de suppression (ADR-036, session restreinte) : la gateway refuse tous les appels de
 * l'Espace pro. L'annulation se fait dans « Mon compte » du portail : on y renvoie.
 */
export function DeletionPending() {
  const t = getDictionary();
  return (
    <section aria-labelledby="suppression-titre" className="grid justify-items-start gap-4">
      <Heading as="h1" size="h2" id="suppression-titre">
        {t.account.deletionPendingTitle}
      </Heading>
      <p className="text-ink-muted">{t.account.deletionPendingText}</p>
      <a
        href={siteConfig.portailUrl}
        className={buttonClasses({ variant: 'primary', size: 'lg', className: 'w-full sm:w-auto' })}
      >
        {t.account.openPortail}
        <IconArrowUpRight />
      </a>
    </section>
  );
}
