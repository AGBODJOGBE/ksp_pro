import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { IconCheck, IconClock } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

/**
 * Écran « bientôt » d'un espace : ce qui arrive, en quelques mots, sans faux contenu. Repérable par
 * `data-coming-soon` (inventaire avant mise en ligne).
 */
export function ComingSoon({
  title,
  children,
  items,
  className,
}: {
  title: string;
  children: ReactNode;
  /** Ce que l'écran apportera. */
  items?: ReadonlyArray<string>;
  className?: string;
}) {
  return (
    <section
      data-coming-soon=""
      aria-labelledby="bientot-titre"
      className={cn('rounded-card border-line bg-surface border p-5 shadow-xs sm:p-6', className)}
    >
      <Badge tone="accent">
        <IconClock className="size-3.5" />
        Bientôt disponible
      </Badge>
      <h2 id="bientot-titre" className="font-display text-ink mt-3 text-xl font-bold">
        {title}
      </h2>
      <p className="text-ink-muted mt-2">{children}</p>
      {items?.length ? (
        <ul className="mt-4 grid gap-2">
          {items.map((item) => (
            <li key={item} className="text-ink flex items-start gap-2.5 font-medium">
              <IconCheck className="text-action-ink mt-0.5 size-5" />
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
