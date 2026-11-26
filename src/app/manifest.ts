import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

/**
 * Manifeste de l'application installable (F-022) : « KSP Pro », plein écran sans barre du navigateur,
 * ouverte sur le choix de l'espace. Icônes tirées du logo KSP (public/icons), dont une version
 * « maskable » à marge de sécurité pour les formes imposées par Android.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    lang: 'fr',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: siteConfig.themeColor,
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
