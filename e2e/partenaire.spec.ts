import { expect, type Page, test } from '@playwright/test';
import {
  type FakeGateway,
  mockGateway,
  PARTNER_ASSIGNMENT_ID,
  PARTNER_GRANTS,
  WITHDRAWN_ASSIGNMENT_ID,
} from './support/gateway';

/**
 * Espace partenaire du Recouvrement (huissiers, avocats), contre la gateway simulée : en réel, la gateway
 * refuse aujourd'hui ces routes (403, prérequis back B1).
 */

const FILE_PATH = `/api/v1/recovery/partner/assignments/${PARTNER_ASSIGNMENT_ID}`;
/** Lectures de la fiche : chacune est inscrite au journal d'audit du back. */
const fileReads = (gateway: FakeGateway) =>
  gateway.calls.filter((call) => call.method === 'GET' && call.path === FILE_PATH);

async function openFile(page: Page) {
  await page.goto('/partenaire');
  await page.getByRole('link', { name: 'REC-2026-00012' }).click();
  await expect(page).toHaveURL(new RegExp(`/partenaire/dossier\\?id=${PARTNER_ASSIGNMENT_ID}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Dossier REC-2026-00012' })).toBeVisible();
}

test('mes dossiers : en cours (« Voir plus »), retirés et terminés ne s’ouvrent pas', async ({ page }) => {
  const gateway = await mockGateway(page, { signedIn: true, grants: PARTNER_GRANTS });
  await page.goto('/partenaire');

  await expect(page.getByRole('heading', { level: 1, name: 'Mes dossiers' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'REC-2026-00012' })).toBeVisible();
  await page.getByRole('button', { name: 'Voir plus' }).click();
  await expect(page.getByRole('link', { name: 'REC-2026-00015' })).toBeVisible();

  await page.getByRole('tab', { name: 'Retirés' }).click();
  const withdrawn = page.getByRole('article', { name: 'REC-2026-00007' });
  await expect(withdrawn).toContainText('Motif : Dossier confié à un avocat pour la procédure judiciaire.');
  await expect(withdrawn).toContainText('Ce dossier ne vous est plus confié : sa fiche ne s’ouvre plus.');
  await expect(withdrawn.getByRole('link')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Terminés' }).click();
  await expect(page.getByRole('article', { name: 'REC-2026-00003' })).toContainText(
    'Mission terminée : la fiche du dossier ne s’ouvre plus.',
  );
  // La liste ne lit jamais la fiche d'un dossier (ni préchargement).
  expect(fileReads(gateway)).toHaveLength(0);
});

test('fiche : une seule lecture par ouverture ; formulaire ouvert et refermé sans relecture', async ({
  page,
}) => {
  const gateway = await mockGateway(page, { signedIn: true, grants: PARTNER_GRANTS });
  await openFile(page);

  await expect(
    page.getByText('Chaque ouverture de ce dossier est enregistrée au journal de KSP.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Appeler Kossi Mensah/ }).first()).toHaveAttribute(
    'href',
    'tel:+2290197001122',
  );
  await expect(page.getByRole('region', { name: 'Échéancier signé' })).toContainText('2 échéances manquées.');
  await expect(page.getByRole('region', { name: 'Pièces de la mission' })).toContainText(
    'Lecture des pièces pas encore possible',
  );

  // Le formulaire s'ouvre dans la page ; le retour du navigateur le ferme, sans relire la fiche.
  await page.getByRole('button', { name: 'Enregistrer un acte' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Enregistrer un acte' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Dossier REC-2026-00012' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(fileReads(gateway)).toHaveLength(1);

  // « Actualiser » : une lecture de plus, demandée.
  await page.getByRole('button', { name: 'Actualiser' }).click();
  await expect.poll(() => fileReads(gateway).length).toBe(2);
});

test('enregistrer un acte avec sa pièce', async ({ page }) => {
  const gateway = await mockGateway(page, { signedIn: true, grants: PARTNER_GRANTS });
  await openFile(page);

  await page.getByRole('button', { name: 'Enregistrer un acte' }).click();
  await page.getByLabel('Type d’acte').selectOption('seizure');
  await page.getByLabel(/Coût de l’acte/).fill('50 000');
  await page.getByLabel('Joindre une pièce').setInputFiles({
    name: 'proces-verbal-saisie.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%KSP\n'),
  });
  await expect(page.getByText('Pièce jointe : proces-verbal-saisie.pdf')).toBeVisible();
  await page.getByLabel(/Note/).fill('Saisie du véhicule du débiteur.');
  await page.getByRole('button', { name: 'Vérifier' }).click();

  await expect(page.getByRole('heading', { name: 'Confirmer l’enregistrement' })).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer l’acte' }).click();
  await expect(
    page.getByText('Acte enregistré. Le créancier et le juriste KSP sont prévenus.'),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Historique des actes' }).getByRole('listitem').first(),
  ).toContainText('Saisie');

  const post = gateway.field.find((entry) => entry.path.endsWith('/acts'));
  expect(post?.key).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  expect(post?.body).toMatchObject({
    type: 'seizure',
    cost: { amount: 50_000, currency: 'XOF' },
    fileId: expect.stringMatching(/^0192f1c4-/),
    note: 'Saisie du véhicule du débiteur.',
  });
  expect(gateway.stored.some((entry) => entry.startsWith('PUT '))).toBe(true);
  expect(fileReads(gateway)).toHaveLength(1);
});

test('déclarer un encaissement : en attente de validation, à virer sous 5 jours ouvrés', async ({ page }) => {
  const gateway = await mockGateway(page, { signedIn: true, grants: PARTNER_GRANTS });
  await openFile(page);

  await page.getByRole('button', { name: 'Déclarer un encaissement' }).click();
  await expect(page.getByText(/Reste dû : 325\s000/)).toBeVisible();
  await page.getByLabel(/Montant reçu/).fill('50000');
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await page.getByRole('button', { name: 'Déclarer l’encaissement' }).click();

  const done = page.getByRole('region', { name: 'Encaissement déclaré' });
  await expect(done).toContainText('En attente de validation par la finance');
  await expect(done).toContainText('À virer à KSP sous 5 jours ouvrés');
  expect(gateway.field.find((entry) => entry.path.endsWith('/collections'))?.body).toMatchObject({
    amount: { amount: 50_000, currency: 'XOF' },
  });
  expect(fileReads(gateway)).toHaveLength(1);
});

test('dossier suspendu : la déclaration est expliquée', async ({ page }) => {
  await mockGateway(page, { signedIn: true, grants: PARTNER_GRANTS, caseSuspended: true });
  await openFile(page);
  await page.getByRole('button', { name: 'Déclarer un encaissement' }).click();
  await page.getByLabel(/Montant reçu/).fill('10000');
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await page.getByRole('button', { name: 'Déclarer l’encaissement' }).click();
  await expect(page.getByText('Dossier suspendu')).toBeVisible();
});

test('dossier retiré : « Ce dossier ne vous est plus confié »', async ({ page }) => {
  await mockGateway(page, { signedIn: true, grants: PARTNER_GRANTS });
  await page.goto(`/partenaire/dossier?id=${WITHDRAWN_ASSIGNMENT_ID}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ce dossier ne vous est plus confié' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Retour à mes dossiers' }).click();
  await expect(page).toHaveURL(/\/partenaire$/);
});

test('403 (accès partenaire pas encore actif, B1) : écran clair et « Actualiser mes accès »', async ({
  page,
}) => {
  await mockGateway(page, { signedIn: true, grants: PARTNER_GRANTS, partnerForbidden: true });
  await page.goto('/partenaire');
  await expect(
    page.getByRole('heading', { name: 'Votre accès partenaire n’est pas encore actif' }),
  ).toBeVisible();
  await expect(
    page.getByText('Contactez KSP pour activer votre accès, puis actualisez vos accès.'),
  ).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Actualiser mes accès' }).click();
  await expect(page.getByText('Vos accès sont à jour.')).toBeVisible();
});

test('notifications : lien du dossier (B2), redirection de /partenaire/dossiers/<id>', async ({ page }) => {
  const gateway = await mockGateway(page, {
    signedIn: true,
    grants: PARTNER_GRANTS,
    partnerNotifications: true,
  });
  await page.goto('/partenaire/notifications');
  await expect(page.getByRole('navigation', { name: 'Espace partenaire' })).toContainText(
    '1 notification non lue',
  );
  await page.getByRole('link', { name: 'Voir le dossier' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dossier REC-2026-00012' })).toBeVisible();

  await page.goto(`/partenaire/dossiers/${PARTNER_ASSIGNMENT_ID}`);
  await expect(page).toHaveURL(new RegExp(`/partenaire/dossier\\?id=${PARTNER_ASSIGNMENT_ID}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Dossier REC-2026-00012' })).toBeVisible();
  expect(fileReads(gateway)).toHaveLength(2);
});

test('compte : profil, préférences de notification', async ({ page }) => {
  const gateway = await mockGateway(page, { signedIn: true, grants: PARTNER_GRANTS });
  await page.goto('/partenaire/compte');
  await expect(page.getByRole('heading', { level: 1, name: 'Mon compte' })).toBeVisible();
  // Profil de la session (aucune lecture de GET /identity/me).
  await expect(page.getByRole('region', { name: 'Mon profil' })).toContainText('Koffi Adjovi');
  await expect(page.getByText('Aucune adresse e-mail vérifiée.')).toBeVisible();
  // Case native masquée sous sa pastille : on touche la pastille, comme au doigt.
  await page.locator('label', { hasText: 'WhatsApp' }).click();
  await expect(page.getByRole('checkbox', { name: 'WhatsApp' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Vos préférences sont enregistrées.')).toBeVisible();
  expect(gateway.calls.find((call) => call.method === 'PUT')?.body).toEqual({ whatsapp: false, email: true });
  expect(gateway.calls.some((call) => call.path === '/api/v1/identity/me')).toBe(false);
});
