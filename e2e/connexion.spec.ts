import { expect, type Page, test } from '@playwright/test';
import { mockGateway, VALID_CODE } from './support/gateway';

/** Connexion par téléphone, contre une gateway simulée (interception des requêtes). */

async function askCode(page: Page) {
  await page.getByRole('textbox', { name: 'Numéro' }).fill('01 97 00 01 01');
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
}

async function openAccountMenu(page: Page) {
  await page.getByRole('button', { name: /^Mon compte/ }).click();
}

test('numéro, code par SMS, profil, choix de l’espace, puis déconnexion', async ({ page }) => {
  const gateway = await mockGateway(page);

  // Sans session : direction la connexion, avec retour prévu.
  await page.goto('/');
  await expect(page).toHaveURL(/\/connexion\?retour=%2F$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Se connecter' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Indicatif' })).toHaveValue('+229');
  await expect(page.getByRole('radio', { name: 'SMS' })).toBeChecked();

  await askCode(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Saisissez votre code' })).toBeVisible();
  await expect(page.getByText('Code envoyé par SMS au +229********01.')).toBeVisible();
  const code = page.getByRole('textbox', { name: /Code reçu/ });
  await expect(code).toBeFocused();
  expect(gateway.calls.find((call) => call.path.endsWith('/otp/request'))?.body).toEqual({
    phone: '+2290197000101',
    channel: 'sms',
  });

  await code.fill(VALID_CODE);
  await page.getByRole('button', { name: 'Valider' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Complétez votre profil' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Prénom' }).fill('Koffi');
  await page.getByRole('textbox', { name: 'Nom', exact: true }).fill('Adjovi');
  await page.getByRole('button', { name: 'Enregistrer et continuer' }).click();

  // Compte sans rôle, jamais candidat : « Devenir agent KSP ».
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Bonjour Koffi' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Devenir agent KSP' })).toBeVisible();

  // Aucun jeton dans le stockage du navigateur.
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain('signature-e2e');

  // Rechargement : jeton perdu (mémoire), session reprise en silence par le renouvellement.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Bonjour Koffi' })).toBeVisible();

  await openAccountMenu(page);
  await expect(page.getByText('+229 01 97 00 01 01')).toBeVisible();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  expect(gateway.calls.some((call) => call.path === '/api/v1/identity/logout')).toBe(true);

  // Plus de session : le choix de l'espace renvoie à la connexion.
  await page.goto('/agent');
  await expect(page).toHaveURL(/\/connexion\?retour=%2Fagent$/);

  // Le navigateur n'envoie que des en-têtes acceptés par la politique CORS de la gateway.
  expect(gateway.forbiddenHeaders).toEqual([]);
});

test('un code incorrect est signalé avec les essais restants', async ({ page }) => {
  await mockGateway(page);
  await page.goto('/connexion');
  await page.getByRole('radio', { name: 'WhatsApp' }).check({ force: true });
  await askCode(page);
  await expect(page.getByText('Code envoyé par WhatsApp au +229********01.')).toBeVisible();

  const code = page.getByRole('textbox', { name: /Code reçu/ });
  await code.fill('000000');
  await page.getByRole('button', { name: 'Valider' }).click();

  await expect(page.getByText('Le code est incorrect. Il vous reste 4 essais.')).toBeVisible();
  await expect(code).toHaveAttribute('aria-invalid', 'true');
});
