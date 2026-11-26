import { expect, test } from '@playwright/test';
import { AGENT_PERMS, mockGateway } from './support/gateway';

/** Choix de l'espace selon le jeton et le Nettoyage, pour chaque profil. */

test('agent : l’application s’ouvre directement sur l’espace agent', async ({ page }) => {
  await mockGateway(page, { signedIn: true, grants: { perms: AGENT_PERMS } });
  await page.goto('/');
  await expect(page).toHaveURL(/\/agent$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible();
  await expect(page.getByRole('banner')).toContainText('Espace agent');
});

test('partenaire : l’application s’ouvre directement sur l’espace partenaire', async ({ page }) => {
  await mockGateway(page, { signedIn: true, grants: { roles: ['customer', 'recovery_bailiff'] } });
  await page.goto('/');
  await expect(page).toHaveURL(/\/partenaire$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mon espace partenaire' })).toBeVisible();
});

test('agent et partenaire : deux grandes cartes', async ({ page }) => {
  await mockGateway(page, {
    signedIn: true,
    grants: { roles: ['customer', 'recovery_lawyer'], perms: AGENT_PERMS },
  });
  await page.goto('/');
  await expect(page.getByText('Choisissez votre espace.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Espace agent' })).toBeVisible();
  await page.getByRole('link', { name: 'Espace partenaire' }).click();
  await expect(page).toHaveURL(/\/partenaire$/);
});

test('candidat : l’état de la candidature', async ({ page }) => {
  await mockGateway(page, { signedIn: true, agentStatus: 'under_review' });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Candidature en cours d’examen' })).toBeVisible();
  await expect(page.getByText('En examen')).toBeVisible();
});

test('candidature acceptée : « Actualiser mes accès » ouvre l’espace agent', async ({ page }) => {
  await mockGateway(page, {
    signedIn: true,
    agentStatus: 'active',
    grantsAfterRefresh: { perms: AGENT_PERMS },
  });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Candidature acceptée' })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Actualiser mes accès' }).click();
  await expect(page).toHaveURL(/\/agent$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible();
});

test('sans droit : l’espace partenaire explique et propose d’actualiser les accès', async ({ page }) => {
  await mockGateway(page, { signedIn: true, grants: { perms: AGENT_PERMS } });
  await page.goto('/partenaire');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Espace partenaire non disponible' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Retour à mes espaces' }).click();
  await expect(page).toHaveURL(/\/agent$/);
});

test('invitation : se connecter avec le numéro invité, l’invitation suit jusqu’à la candidature', async ({
  page,
}) => {
  await mockGateway(page, { named: true });
  await page.goto('/invitations/0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e20');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vous êtes invité à devenir agent KSP' }),
  ).toBeVisible();
  await expect(page.getByText('Invitation enregistrée sur ce téléphone.')).toBeVisible();

  await page.getByRole('link', { name: 'Se connecter avec ce numéro' }).click();
  await expect(page).toHaveURL(/\/connexion\?retour=%2Fcandidature$/);
  await page.getByRole('textbox', { name: 'Numéro' }).fill('01 97 00 01 01');
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await page.getByRole('textbox', { name: /Code reçu/ }).fill('482913');
  await page.getByRole('button', { name: 'Valider' }).click();

  await expect(page).toHaveURL(/\/candidature$/);
  await expect(page.getByText('Votre invitation sera jointe à la candidature.')).toBeVisible();
});
