import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Action principale fixée en bas de l'écran sur téléphone (sous le pouce, une main), dans le flux de la
 * page dès 640 px. Un espace de même hauteur est réservé en bas de page pour que la barre ne cache rien.
 * Placée dans un formulaire, elle en garde le bouton d'envoi (position seulement, pas de portail).
 * Au-dessus d'une barre de navigation du bas (`--bottom-nav-h`, espace agent), elle se pose dessus.
 */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <>
      <div aria-hidden="true" className="h-28 sm:hidden" />
      <div
        data-bottom-bar=""
        className={cn(
          'border-line bg-surface pb-safe fixed inset-x-0 bottom-(--bottom-nav-h) z-(--z-header) grid gap-2 border-t px-4 pt-3 shadow-[0_-8px_24px_-16px_rgb(15_40_80/0.35)]',
          'sm:static sm:z-auto sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none',
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
