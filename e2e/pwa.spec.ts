import { expect, test } from '@playwright/test';

/** Application installable : manifeste, icônes, service worker, page hors connexion, en-têtes. */

test('le manifeste « KSP Pro » est servi avec ses icônes', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: 'KSP Pro',
    short_name: 'KSP Pro',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#0F2850',
  });
  const purposes = manifest.icons.map(
    (icon: { sizes: string; purpose: string }) => `${icon.sizes} ${icon.purpose}`,
  );
  expect(purposes).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
  for (const icon of manifest.icons as Array<{ src: string }>) {
    const image = await request.get(icon.src);
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toBe('image/png');
  }
});

test('le service worker est revalidé à chaque visite, sous 5 Ko', async ({ request }) => {
  const response = await request.get('/sw.js');
  expect(response.ok()).toBe(true);
  expect(response.headers()['cache-control']).toBe('no-cache');
  expect(response.headers()['content-type']).toContain('javascript');
  expect((await response.body()).byteLength).toBeLessThanOrEqual(5 * 1024);
});

test('en-têtes : CSP du service worker et du manifeste, appareil photo et position pour le site', async ({
  request,
}) => {
  const headers = (await request.get('/hors-ligne')).headers();
  expect(headers['content-security-policy']).toContain("worker-src 'self'");
  expect(headers['content-security-policy']).toContain("manifest-src 'self'");
  expect(headers['permissions-policy']).toContain('camera=(self)');
  expect(headers['permissions-policy']).toContain('geolocation=(self)');
  expect(headers['x-robots-tag']).toBe('noindex, nofollow');
});

test('la page hors connexion est claire', async ({ page }) => {
  await page.goto('/hors-ligne');
  await expect(page.getByRole('heading', { level: 1, name: 'Pas de connexion' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
});

test('la sonde de santé répond', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(await response.json()).toMatchObject({ status: 'ok', site: 'pro' });
});

test.describe('hors connexion', () => {
  test.use({ serviceWorkers: 'allow' });

  test('sans réseau, une page jamais ouverte affiche la page hors connexion', async ({ page, context }) => {
    await page.goto('/hors-ligne');
    // Le service worker s'installe (page hors connexion gardée), puis prend la main sur la page.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await context.setOffline(true);
    await page.goto('/partenaire').catch(() => undefined);
    await expect(page.getByRole('heading', { level: 1, name: 'Pas de connexion' })).toBeVisible();

    // La page déjà ouverte reste disponible sans réseau.
    await page.goto('/hors-ligne');
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
    await context.setOffline(false);
  });
});
