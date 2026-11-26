import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3050);

/** Tests de bout en bout : parcours vus par l'agent ou le partenaire, sur téléphone d'abord. */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    // Le service worker est bloqué par défaut : la gateway simulée intercepte les requêtes de la page.
    // Les parcours hors ligne l'autorisent (`test.use({ serviceWorkers: 'allow' })`).
    serviceWorkers: 'block',
    // Permet d'utiliser un Chromium déjà installé sur le poste (optionnel).
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Le site construit (pnpm build) est servi comme en production : serveur autonome.
    command: `PORT=${port} pnpm start`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
