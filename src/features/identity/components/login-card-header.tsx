import type { ReactNode } from 'react';
import { IconUser } from '@/components/ui/icons';

/**
 * En-tête de la carte de connexion : avatar rond bleu nuit cerclé d'orange (accent de l'Espace pro),
 * titre, sous-titre court. Présentation seulement : chaque étape garde son titre (`id`).
 */
export function LoginCardHeader({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="text-center">
      <span className="bg-brand text-on-brand ring-accent ring-offset-surface mx-auto grid size-14 place-items-center rounded-full ring-4 ring-offset-2">
        <IconUser className="size-7" />
      </span>
      <h1 id={id} className="font-display text-h2 text-ink mt-5 font-bold">
        {title}
      </h1>
      {children ? <div className="text-ink-muted mt-2">{children}</div> : null}
    </div>
  );
}
