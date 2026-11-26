'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { IconBriefcase, IconCalendar, IconClock, IconUser } from '@/components/ui/icons';
import { navigation } from '@/config/navigation';
import { cn } from '@/lib/cn';

/** Libellés écrits ici : la navigation est lue par toutes les pages de l'espace, sans les textes des écrans. */
const ITEMS = [
  { ...navigation.agentToday, icon: IconClock, exact: true },
  { ...navigation.agentAssignments, icon: IconBriefcase, exact: false },
  { ...navigation.agentAvailability, icon: IconCalendar, exact: false },
  { ...navigation.agentProfile, icon: IconUser, exact: false },
] as const;

/** Fiches et notifications : rattachées à « Aujourd'hui ». */
const TODAY_CHILDREN = [
  navigation.agentVisit.href,
  navigation.agentSession.href,
  navigation.agentNotifications.href,
];

function isActive(pathname: string, item: (typeof ITEMS)[number]): boolean {
  if (item.exact) return pathname === item.href || TODAY_CHILDREN.some((href) => pathname.startsWith(href));
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Cadre de l'espace agent : navigation à 4 entrées (Aujourd'hui, Affectations, Disponibilités, Profil),
 * fixée en bas de l'écran du téléphone (une main, cibles de 64 px de haut), en onglets au-dessus du
 * contenu dès 640 px. Réserve sa hauteur (`--bottom-nav-h`) : une barre d'action se pose au-dessus.
 */
export function AgentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="[--bottom-nav-h:calc(4.25rem+env(safe-area-inset-bottom))] sm:[--bottom-nav-h:0px]">
      <nav
        aria-label="Espace agent"
        className={cn(
          'border-line bg-surface fixed inset-x-0 bottom-0 z-(--z-header) border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(15_40_80/0.35)]',
          'sm:static sm:z-auto sm:mb-8 sm:border-t-0 sm:border-b sm:bg-transparent sm:pb-0 sm:shadow-none',
        )}
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-4 sm:flex sm:gap-1">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'focus-visible:outline-focus flex min-h-17 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2',
                    'sm:-mb-px sm:min-h-12 sm:flex-row sm:gap-2 sm:border-b-2 sm:px-4 sm:text-base',
                    active
                      ? 'text-action-ink sm:border-action sm:text-ink'
                      : 'text-ink-muted hover:text-ink sm:border-transparent',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid h-8 w-14 place-items-center rounded-full sm:h-auto sm:w-auto',
                      active && 'bg-action-soft sm:bg-transparent',
                    )}
                  >
                    <Icon className="size-6 sm:size-5" />
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {children}
      <div aria-hidden="true" className="h-(--bottom-nav-h) sm:hidden" />
    </div>
  );
}
