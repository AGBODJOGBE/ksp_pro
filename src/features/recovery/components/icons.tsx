import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * Icônes propres aux écrans du partenaire (téléphone, e-mail, pièce), dessinées comme celles de
 * `components/ui/icons` (trait de 1,75 sur une grille de 24, décoratives). Elles vivent ici parce que le
 * module des icônes communes est lu par toutes les pages : toute icône qu'on y utilise en plus alourdit
 * aussi les fiches de terrain de l'agent, à moins de 1 Ko du budget.
 */

function Glyph({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5 shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function PhoneGlyph({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M5 4h3.5l1.5 4-2.2 1.4a11 11 0 0 0 6.8 6.8L16 14l4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z" />
    </Glyph>
  );
}

export function MailGlyph({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </Glyph>
  );
}

export function DocumentGlyph({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z" />
      <path d="M14 3v4h4M9.5 14.5l2 2 3.5-4" />
    </Glyph>
  );
}
