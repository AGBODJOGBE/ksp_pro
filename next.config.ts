import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005';
/**
 * Stockage des fichiers (service file, ADR-038) : les photos de terrain y sont envoyées directement, à une
 * adresse présignée. Origine fixée au build, facultative : sans elle, l'envoi des photos est refusé par la CSP.
 */
const fileStorageOrigin = process.env.NEXT_PUBLIC_FILE_STORAGE_ORIGIN?.trim() ?? '';

/**
 * Politique de sécurité du contenu : le navigateur ne parle qu'au site lui-même et à la gateway.
 * Le service worker et le manifeste viennent du site (`worker-src`, `manifest-src`). À durcir (nonce sur
 * les scripts) comme pour le portail.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Le stockage des fichiers (photos, pièces) ; en local il est en http (MinIO), d'où sa mention explicite.
  `img-src 'self' data: blob: https:${fileStorageOrigin ? ` ${fileStorageOrigin}` : ''}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiUrl}${fileStorageOrigin ? ` ${fileStorageOrigin}` : ''}${isDev ? ' ws:' : ''}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Terrain : photos (appareil photo) et position à l'arrivée sur un lieu, pour ce site seulement.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
];

const nextConfig: NextConfig = {
  // Image Docker minimale : seul le serveur autonome et ses dépendances sont copiés.
  output: 'standalone',
  poweredByHeader: false,
  // Empêche `next dev` d'ajouter des blocs générés aux fichiers de documentation locaux.
  agentRules: false,
  reactStrictMode: true,
  async redirects() {
    return [
      // Lien des notifications du partenaire (proposé au back, prérequis B2) : la fiche n'a qu'une coque
      // statique, l'identifiant passe dans la recherche. Temporaire : le format du lien reste à valider.
      {
        source: '/partenaire/dossiers/:id',
        destination: '/partenaire/dossier?id=:id',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Service worker : toujours revalidé, pour qu'une nouvelle version soit vue dès la visite suivante.
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      // Lien d'invitation d'un agent : l'identifiant ne part vers aucun autre site.
      { source: '/invitations/:id', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
    ];
  },
};

export default nextConfig;
