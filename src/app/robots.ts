import type { MetadataRoute } from 'next';

/** Espace réservé aux professionnels : aucun robot (voir aussi `X-Robots-Tag` dans next.config.ts). */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
