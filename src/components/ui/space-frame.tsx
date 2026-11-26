import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SpaceNavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  /**
   * Pastille (nombre de non lues), placée après le libellé : posée sur l'icône sur téléphone (position
   * absolue dans le lien), à côté du libellé dès 640 px. Elle porte son propre texte pour les lecteurs
   * d'écran.
   */
  badge?: ReactNode;
}

const COLUMNS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

/**
 * Cadre d'un espace : navigation fixée en bas de l'écran du téléphone (une main, cibles de 68 px de haut),
 * en onglets au-dessus du contenu dès 640 px. Réserve sa hauteur (`--bottom-nav-h`) : une barre d'action
 * (`BottomBar`) se pose au-dessus. `before` : bandeau entre la navigation et le contenu.
 */
export function SpaceFrame({
  label,
  items,
  before,
  children,
}: {
  label: string;
  items: ReadonlyArray<SpaceNavItem>;
  before?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="[--bottom-nav-h:calc(4.25rem+env(safe-area-inset-bottom))] sm:[--bottom-nav-h:0px]">
      <nav
        aria-label={label}
        className={cn(
          'border-line bg-surface fixed inset-x-0 bottom-0 z-(--z-header) border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(15_40_80/0.35)]',
          'sm:static sm:z-auto sm:mb-8 sm:border-t-0 sm:border-b sm:bg-transparent sm:pb-0 sm:shadow-none',
        )}
      >
        <ul className={cn('mx-auto grid max-w-2xl sm:flex sm:gap-1', COLUMNS[items.length] ?? 'grid-cols-4')}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  className={cn(
                    'focus-visible:outline-focus relative flex min-h-17 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2',
                    'sm:-mb-px sm:min-h-12 sm:flex-row sm:gap-2 sm:border-b-2 sm:px-4 sm:text-base',
                    item.active
                      ? 'text-action-ink sm:border-action sm:text-ink'
                      : 'text-ink-muted hover:text-ink sm:border-transparent',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid h-8 w-14 place-items-center rounded-full sm:h-auto sm:w-auto',
                      item.active && 'bg-action-soft sm:bg-transparent',
                    )}
                  >
                    <Icon className="size-6 sm:size-5" />
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                  {item.badge}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {before}
      {children}
      <div aria-hidden="true" className="h-(--bottom-nav-h) sm:hidden" />
    </div>
  );
}
