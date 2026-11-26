import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginFlow } from '@/features/identity';
import { getDictionary } from '@/i18n';

export const metadata: Metadata = { title: getDictionary().login.title };

/**
 * Connexion par téléphone : coque statique, parcours dans un composant client (F-005, option A). Le même
 * parcours connecte ou crée le compte.
 */
export default function LoginPage() {
  const t = getDictionary();
  return (
    <div className="sm:rounded-card sm:border-line sm:bg-surface sm:border sm:px-10 sm:pt-10 sm:pb-8 sm:shadow-sm">
      {/* Lecture de ?retour= : sous Suspense pour garder la page statique. */}
      <Suspense
        fallback={
          <p role="status" className="text-ink-muted text-center">
            {t.login.checking}
          </p>
        }
      >
        <LoginFlow />
      </Suspense>
    </div>
  );
}
