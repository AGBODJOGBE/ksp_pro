'use client';

import { usePathname } from 'next/navigation';
import { spaceLabel } from '@/config/navigation';

/** Nom de l'espace ouvert, d'après l'adresse (« Espace agent », « Espace partenaire »…). */
export function SpaceName() {
  return (
    <p className="font-display text-ink min-w-0 truncate text-base font-bold sm:text-lg">
      {spaceLabel(usePathname())}
    </p>
  );
}
