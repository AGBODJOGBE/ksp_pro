import { expect, type Page, test } from '@playwright/test';
import { AGENT_PERMS, mockGateway } from './support/gateway';

/** Agent du Nettoyage, partie en ligne : candidature, suivi, affectations, disponibilités. */

/** Petite image JPEG valide (1 × 1 pixel). */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);
const photo = (name: string) => ({ name, mimeType: 'image/jpeg', buffer: JPEG });

const next = (page: Page) => page.getByRole('button', { name: 'Continuer' }).click();
const step = (page: Page, name: string) =>
  expect(page.getByRole('heading', { level: 2, name })).toBeVisible();

test('candidature complète : étapes, photos, envoi, puis suivi', async ({ page }) => {
  const gateway = await mockGateway(page, { signedIn: true, skillsReadable: true });
  await page.goto('/candidature');

  await step(page, 'Votre identité');
  await expect(page.getByRole('textbox', { name: 'Prénom' })).toHaveValue('Koffi');
  await next(page);

  await step(page, 'Votre photo');
  await page.getByLabel('Prendre ou choisir une photo').setInputFiles(photo('moi.jpg'));
  await expect(page.getByText(/Photo envoyée/)).toBeVisible();
  await next(page);

  await step(page, 'Votre pièce d’identité');
  // Champs par identifiant : le libellé devient « Changer la photo » une fois la photo envoyée.
  await page.locator('#candidature-idFront').setInputFiles(photo('recto.jpg'));
  await expect(page.getByText(/Photo envoyée/)).toHaveCount(1);
  await page.locator('#candidature-idBack').setInputFiles(photo('verso.jpg'));
  await expect(page.getByText(/Photo envoyée/)).toHaveCount(2);
  await next(page);

  await step(page, 'Votre commune de résidence');
  await page.getByRole('combobox', { name: /Commune/ }).selectOption('cotonou');
  await next(page);
  await step(page, 'Où voulez-vous travailler ?');
  await page.getByText('Cotonou', { exact: true }).click();
  await page.getByText('Abomey-Calavi', { exact: true }).click();
  await next(page);

  await step(page, 'Vos compétences');
  await page.getByText('Nettoyage intérieur', { exact: true }).click();
  await next(page);

  await step(page, 'Vos disponibilités');
  await page.getByRole('checkbox', { name: 'Lundi' }).check();
  await page.getByRole('checkbox', { name: 'Samedi' }).check();
  await next(page);

  await step(page, 'Personne à prévenir');
  await page.getByRole('textbox', { name: 'Nom et prénom' }).fill('Afi Adjovi');
  await page.getByRole('textbox', { name: /Téléphone/ }).fill('01 97 00 00 46');
  await next(page);
  await step(page, 'Votre statut');
  await page.getByText('Indépendant partenaire', { exact: true }).click();
  await next(page);
  await step(page, 'Numéro Mobile Money');
  await next(page);

  await step(page, 'Vérifiez votre candidature');
  await expect(page.getByText('Recto et verso fournis')).toBeVisible();
  await page.getByRole('button', { name: 'Envoyer ma candidature' }).click();

  await expect(page.getByText('Candidature envoyée. L’équipe KSP va l’examiner.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Candidature envoyée' })).toBeVisible();
  const submit = gateway.calls.find((call) => call.path === '/api/v1/cleaning/agent/applications');
  expect(submit?.headers['idempotency-key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  expect(submit?.body).toMatchObject({
    residenceCommuneKey: 'cotonou',
    zoneKeys: ['cotonou', 'abomey-calavi'],
    skillCodes: ['interior_cleaning'],
    employmentKind: 'independent',
    emergencyContact: { name: 'Afi Adjovi', phone: '+2290197000046' },
    weekly: [
      { weekday: 'mon', ranges: [{ start: '08:00', end: '17:00' }] },
      { weekday: 'sat', ranges: [{ start: '08:00', end: '17:00' }] },
    ],
  });
  // Contenu envoyé au stockage, jamais à la gateway.
  expect(gateway.stored).toHaveLength(3);

  // Le suivi relit l'état au rechargement : plus de formulaire.
  await page.reload();
  await expect(page.getByText('Candidature envoyée', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Actualiser' })).toBeVisible();
});

test('brouillon : la candidature reprend où elle s’était arrêtée', async ({ page }) => {
  await mockGateway(page, { signedIn: true, skillsReadable: true });
  await page.goto('/candidature');
  await next(page);
  await step(page, 'Votre photo');

  await page.reload();
  await step(page, 'Votre photo');
  await expect(page.getByText('Brouillon retrouvé : vous reprenez où vous vous étiez arrêté.')).toBeVisible();
});

test('candidature acceptée : actualiser les accès, puis ouvrir l’espace agent', async ({ page }) => {
  await mockGateway(page, {
    signedIn: true,
    agentStatus: 'active',
    grantsAfterRefresh: { perms: AGENT_PERMS },
  });
  await page.goto('/candidature');

  await expect(page.getByText('Candidature acceptée')).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Actualiser mes accès' }).click();
  await page.getByRole('link', { name: 'Ouvrir mon espace agent' }).click();
  await expect(page).toHaveURL(/\/agent$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible();
});

test('affectations : un indépendant accepte une affectation avant l’échéance', async ({ page }) => {
  const gateway = await mockGateway(page, {
    signedIn: true,
    grants: { perms: AGENT_PERMS },
    agentStatus: 'active',
  });
  await page.goto('/agent');
  await page.getByRole('link', { name: /1 affectation attend votre réponse/ }).click();
  await expect(page).toHaveURL(/\/agent\/affectations$/);

  await page.getByRole('tab', { name: 'À confirmer' }).click();
  const panel = page.getByRole('tabpanel', { name: 'À confirmer' });
  await expect(panel.getByText(/Répondez avant/)).toBeVisible();
  await panel.getByRole('button', { name: 'Accepter' }).click();
  await expect(panel.getByText('Affectation acceptée.')).toBeVisible();
  await expect(panel.getByText('Confirmée', { exact: true })).toBeVisible();
  const accept = gateway.calls.find((call) => call.path.endsWith('/accept'));
  expect(accept?.headers['idempotency-key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
});

test('affectations : un salarié n’a rien à accepter', async ({ page }) => {
  await mockGateway(page, {
    signedIn: true,
    grants: { perms: AGENT_PERMS },
    agentStatus: 'active',
    employmentKind: 'employee',
  });
  await page.goto('/agent/affectations');
  await expect(page.getByText(/vous n’avez pas à les accepter/)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'À confirmer' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Accepter' })).toHaveCount(0);
});

test('disponibilités : semaine type enregistrée, puis plage occupée expliquée', async ({ page }) => {
  const gateway = await mockGateway(page, {
    signedIn: true,
    grants: { perms: AGENT_PERMS },
    agentStatus: 'active',
  });
  await page.goto('/agent/disponibilites');

  await page.getByRole('checkbox', { name: 'Mardi' }).check();
  await page.getByRole('button', { name: 'Enregistrer mes disponibilités' }).click();
  await expect(page.getByText('Vos disponibilités sont enregistrées.')).toBeVisible();
  const put = gateway.calls.find((call) => call.method === 'PUT');
  expect((put?.body as { weekly: Array<{ weekday: string }> }).weekly.map((rule) => rule.weekday)).toEqual([
    'mon',
    'tue',
    'wed',
    'sat',
  ]);
});

test('disponibilités : plage occupée et indisponibilité en conflit, expliquées', async ({ page }) => {
  await mockGateway(page, {
    signedIn: true,
    grants: { perms: AGENT_PERMS },
    agentStatus: 'active',
    availabilityInUse: true,
    unavailabilityConflict: true,
  });
  await page.goto('/agent/disponibilites');

  await page.getByRole('checkbox', { name: 'Lundi' }).uncheck();
  await page.getByRole('button', { name: 'Enregistrer mes disponibilités' }).click();
  await expect(
    page.getByText(/déjà occupée par 1 affectation\. Pour la libérer, contactez votre superviseur KSP/),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Déclarer une indisponibilité' }).click();
  await page.getByText('Congé', { exact: true }).last().click();
  await page.getByRole('button', { name: 'Enregistrer l’indisponibilité' }).click();
  await expect(page.getByText(/chevauche 2 affectations déjà prévues/)).toBeVisible();
});

test('profil, activité et notifications de l’agent', async ({ page }) => {
  await mockGateway(page, { signedIn: true, grants: { perms: AGENT_PERMS }, agentStatus: 'active' });
  await page.goto('/agent/profil');
  await expect(page.getByRole('heading', { name: 'Koffi Adjovi' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Par semaine' })).toBeVisible();

  await page.getByRole('link', { name: /Notifications — 1 notification non lue/ }).click();
  await expect(page).toHaveURL(/\/agent\/notifications$/);
  await page.getByRole('button', { name: 'Marquer comme lue' }).click();
  await expect(page.getByText('Aucune non lue')).toBeVisible();
});
