import type { Metadata } from 'next';
import { OfflineRetry } from '@/components/layout/offline-retry';
import { Heading } from '@/components/ui/heading';
import { IconWifiOff } from '@/components/ui/icons';
import { getDictionary } from '@/i18n';

export const metadata: Metadata = { title: getDictionary().offline.title };

/**
 * Page hors connexion : servie par le service worker quand une page demandée n'est pas enregistrée sur
 * l'appareil et que le réseau ne répond pas. Statique, sans appel à la gateway ; mise en cache dès
 * l'installation du service worker, avec ses styles.
 */
export default function OfflinePage() {
  const t = getDictionary().offline;
  return (
    <section aria-labelledby="hors-ligne-titre" className="grid justify-items-start gap-4">
      <span
        aria-hidden="true"
        className="rounded-icon bg-brand text-on-brand ring-accent grid size-16 place-items-center ring-4 ring-offset-2"
      >
        <IconWifiOff className="size-8" />
      </span>
      <Heading as="h1" size="h2" id="hors-ligne-titre">
        {t.title}
      </Heading>
      <p className="text-ink text-lg">{t.text}</p>
      <p className="text-ink-muted">{t.hint}</p>
      <OfflineRetry label={t.retry} />
    </section>
  );
}
