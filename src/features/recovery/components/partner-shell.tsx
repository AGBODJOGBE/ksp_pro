'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { IconBell, IconBriefcase, IconUser } from '@/components/ui/icons';
import { SpaceFrame } from '@/components/ui/space-frame';
import { partnerNavigation as nav } from '@/config/partner-navigation';

/**
 * Cadre de l'espace partenaire (huissiers, avocats) : navigation à 3 entrées (Dossiers, Notifications,
 * Compte), en bas de l'écran du téléphone, en onglets dès 640 px, comme l'espace agent. La fiche d'un
 * dossier est rattachée à « Dossiers ». `notificationBadge` : pastille des non lues, fournie par la page
 * (la fonctionnalité ne connaît pas les notifications). Libellés écrits ici : le cadre est lu par toutes
 * les pages de l'espace, sans les textes des écrans.
 */
export function PartnerShell({
  children,
  notificationBadge,
}: {
  children: ReactNode;
  notificationBadge?: ReactNode;
}) {
  const pathname = usePathname();
  const within = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const items = [
    {
      ...nav.assignments,
      icon: IconBriefcase,
      active: pathname === nav.assignments.href || within(nav.file.href),
    },
    {
      ...nav.notifications,
      icon: IconBell,
      active: within(nav.notifications.href),
      badge: notificationBadge,
    },
    { ...nav.account, icon: IconUser, active: within(nav.account.href) },
  ];
  return (
    <SpaceFrame label="Espace partenaire" items={items}>
      {children}
    </SpaceFrame>
  );
}
