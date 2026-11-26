import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconChevronRight } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

/**
 * Grande carte de choix, cliquable en entier (lien étiré) : tuile d'icône, titre, texte court, chevron.
 * Cible très large (au moins 96 px de haut) pour le terrain. `highlight` : liseré d'accent de l'Espace pro.
 */
export function ChoiceCard({
  href,
  title,
  text,
  icon,
  badge,
  highlight = false,
  className,
}: {
  href: string;
  title: string;
  text: ReactNode;
  icon: ReactNode;
  badge?: ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-card bg-surface relative flex h-full min-h-24 items-center gap-4 border-2 p-4 shadow-xs sm:p-5',
        'ease-soft transition-[border-color,box-shadow] duration-(--motion-base) hover:shadow-sm',
        'has-[.stretched-link:focus-visible]:outline-focus has-[.stretched-link:focus-visible]:outline-2 has-[.stretched-link:focus-visible]:outline-offset-3',
        highlight ? 'border-accent' : 'border-line hover:border-line-strong',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'rounded-icon grid size-14 shrink-0 place-items-center',
          highlight ? 'bg-accent text-on-accent' : 'bg-brand text-on-brand',
        )}
      >
        {icon}
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <Link
            href={href}
            className="stretched-link font-display text-ink text-xl leading-snug font-bold focus-visible:outline-none"
          >
            {title}
          </Link>
          {badge}
        </span>
        <span className="text-ink-muted">{text}</span>
      </span>
      <IconChevronRight className="text-ink size-6" />
    </div>
  );
}
