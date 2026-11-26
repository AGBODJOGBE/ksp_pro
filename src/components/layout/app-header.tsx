import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/ui/brand/logo';
import { SpaceName } from './space-name';

/**
 * En-tête de l'Espace pro : barre bleu nuit (couleur de l'application installée), logo et pastille
 * « Pro » (retour au choix de l'espace), nom de l'espace ouvert, menu du compte. Reçoit le menu du compte
 * par `account` : le cadre ne connaît aucune fonctionnalité.
 */
export function AppHeader({ homeLabel, account }: { homeLabel: string; account?: ReactNode }) {
  return (
    <header
      data-tone="inverse"
      className="sticky top-0 z-(--z-header) border-b border-white/10 pt-[env(safe-area-inset-top)]"
    >
      <div className="mx-auto flex h-(--header-h) w-full max-w-2xl items-center gap-3 px-3 sm:px-6">
        <Link
          href="/"
          aria-label={homeLabel}
          className="focus-visible:outline-focus flex min-h-12 shrink-0 items-center gap-2 rounded-md"
        >
          <LogoMark variant="horizontal" className="h-6 w-auto sm:h-7" />
          <span className="bg-accent text-on-accent rounded-full px-2 py-0.5 text-xs font-extrabold tracking-wider uppercase">
            Pro
          </span>
        </Link>
        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-white/20" />
        <SpaceName />
        <div className="ml-auto shrink-0">{account}</div>
      </div>
    </header>
  );
}
