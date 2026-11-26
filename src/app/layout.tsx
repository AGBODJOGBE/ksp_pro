import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { InstallPrompt } from '@/components/layout/lazy';
import { ServiceWorkerRegistration } from '@/components/layout/service-worker';
import { siteConfig } from '@/config/site';
import { AccountMenu } from '@/features/identity';
import { getDictionary } from '@/i18n';
import { displayFont } from './fonts/display';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // Espace réservé aux professionnels : jamais indexé.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: siteConfig.shortName, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Contenu sous l'encoche et la barre de gestes : les marges de sécurité sont gérées par la page.
  viewportFit: 'cover',
  themeColor: siteConfig.themeColor,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const t = getDictionary();
  return (
    <html lang="fr" className={displayFont.variable}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenu"
          className="focus:bg-brand focus:text-on-brand focus:rounded-control sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-float) focus:px-4 focus:py-3 focus:font-semibold"
        >
          {t.common.skipToContent}
        </a>
        <AppHeader homeLabel={t.header.home} account={<AccountMenu />} />
        <InstallPrompt texts={t.install} />
        <main
          id="contenu"
          tabIndex={-1}
          className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-10 focus:outline-none sm:px-6 sm:pt-10"
        >
          {children}
        </main>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
