'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker (`public/sw.js`, F-022), en production seulement : en développement, il
 * garderait d'anciennes versions des pages. Sans service worker (navigateur ancien), le site marche en
 * ligne comme avant.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      console.warn('Service worker non enregistré', error);
    });
  }, []);
  return null;
}
