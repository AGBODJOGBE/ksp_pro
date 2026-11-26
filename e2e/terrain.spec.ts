import { expect, type Page, test } from '@playwright/test';
import { AGENT_PERMS, JPEG, mockGateway, SESSION_ID, setNetwork, VISIT_ID } from './support/gateway';

/** Agent du Nettoyage sur le terrain : visite des lieux, séance, gestes hors connexion rejoués au retour du réseau. */

const KEY = /^[A-Za-z0-9_-]{8,100}$/;
const photo = (name: string) => ({ name, mimeType: 'image/jpeg', buffer: JPEG });
const agent = { signedIn: true, grants: { perms: AGENT_PERMS }, agentStatus: 'active' } as const;

test.use({
  permissions: ['geolocation'],
  geolocation: { latitude: 6.4484, longitude: 2.3558, accuracy: 12 },
});

/** Signature au doigt dans le cadre (trois segments). */
async function sign(page: Page) {
  const pad = page.getByRole('img', { name: 'Cadre de signature vide' });
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  if (!box) throw new Error('cadre de signature introuvable');
  await page.mouse.move(box.x + 20, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 30, { steps: 4 });
  await page.mouse.move(box.x + 160, box.y + 110, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole('img', { name: 'Signature prise' })).toBeVisible();
}

/** Actions gardées dans IndexedDB (`ksp-pro`, magasin `outbox`), dans l'ordre. */
function outboxOf(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Array<{ type: string; key: string; body: Record<string, unknown> }>>((resolve, reject) => {
        const open = indexedDB.open('ksp-pro');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction('outbox').objectStore('outbox').getAll();
          request.onsuccess = () => {
            open.result.close();
            resolve(request.result);
          };
        };
      }),
  );
}

test('visite complète : arrivée avec position, constat, photo, fin', async ({ page }) => {
  const gateway = await mockGateway(page, agent);
  await page.goto(`/agent/visite?id=${VISIT_ID}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Visite des lieux' })).toBeVisible();
  await expect(
    page.getByText(/L’adresse exacte et le repère s’affichent quand vous marquez votre arrivée/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Je suis arrivé' }).click();
  await expect(page.getByRole('link', { name: /Itinéraire/ })).toBeVisible();
  await expect(page.getByText('Repère : Portail bleu après la pharmacie')).toBeVisible();

  // Constat : prérempli avec le déclaré ; « Très sale », désactivé, n'est plus proposé.
  await expect(page.getByRole('textbox', { name: /Superficie/ })).toHaveValue('120');
  await page.getByRole('textbox', { name: /Superficie/ }).fill('150');
  await page.getByText('Sale', { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer le constat' }).click();
  await expect(page.getByText('Constat enregistré.')).toBeVisible();

  await page.getByLabel('Prendre une photo').setInputFiles(photo('salon.jpg'));
  await expect(page.getByRole('list', { name: 'Photos' }).getByRole('img')).toHaveCount(1);

  await page.getByRole('button', { name: 'Visite terminée' }).click();
  await page.getByRole('button', { name: 'Oui, terminer' }).click();
  await expect(page.getByText(/Visite terminée à \d\d:\d\d/)).toBeVisible();
  // Affichée tout de suite comme faite, pendant l'envoi.
  await expect.poll(() => gateway.field.length).toBe(4);

  expect(gateway.field.map((call) => `${call.method} ${call.path.split('/').pop()}`)).toEqual([
    'POST arrive',
    'PUT observations',
    'POST photos',
    'POST complete',
  ]);
  expect(gateway.field[0]?.body).toMatchObject({ latitude: 6.4484, longitude: 2.3558, accuracyMeters: 12 });
  expect(gateway.field[1]?.body).toMatchObject({ values: { superficie: 150, etat: 'sale', animaux: false } });
  expect(gateway.field[2]?.body).toMatchObject({
    fileId: expect.any(String),
    occurredAt: expect.any(String),
  });
  for (const call of gateway.field) expect(call.key).toMatch(KEY);
  expect(gateway.stored).toHaveLength(1);
});

test('séance complète : arrivée, photos, démarrage, liste, clôture signée', async ({ page }) => {
  const gateway = await mockGateway(page, agent);
  await page.goto(`/agent/seance?id=${SESSION_ID}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Séance de nettoyage' })).toBeVisible();
  await expect(page.getByText(/Vous êtes chef d’équipe/)).toBeVisible();
  await page.getByRole('button', { name: 'Je suis arrivé' }).click();
  await expect(page.getByText(/Arrivé à \d\d:\d\d, à 42 m du lieu/)).toBeVisible();

  await page.locator('#photo-before-principale').setInputFiles(photo('avant.jpg'));
  await expect(page.getByRole('list', { name: 'Photos « avant »' }).getByRole('img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Démarrer la séance' }).click();
  await expect(page.getByText(/Démarrée à \d\d:\d\d/)).toBeVisible();

  await page.getByText('Matériel déballé').click();
  await page.getByText('Sols balayés').click();
  await expect(page.getByText('2 / 2 points faits')).toBeVisible();

  await page.locator('#photo-after-principale').setInputFiles(photo('apres.jpg'));
  await expect(page.getByRole('list', { name: 'Photos « après »' }).getByRole('img')).toHaveCount(1);

  await page.getByRole('button', { name: 'Clôturer la séance' }).click();
  await sign(page);
  await page.getByRole('button', { name: 'Clôturer la séance' }).click();
  await expect(page.getByText(/Séance réalisée, clôturée à \d\d:\d\d/)).toBeVisible();
  // Affichée tout de suite comme faite ; la clôture part après le dépôt de la signature.
  await expect.poll(() => gateway.field.length).toBe(7);

  expect(gateway.field.map((call) => `${call.method} ${call.path.split('/').pop()}`)).toEqual([
    'POST arrive',
    'POST photos',
    'POST start',
    'PATCH checklist',
    'PATCH checklist',
    'POST photos',
    'POST complete',
  ]);
  expect(gateway.field[6]?.body).toMatchObject({ signatureFileId: expect.any(String) });
  // Deux photos et la signature : déposées au stockage, jamais à la gateway.
  expect(gateway.stored).toHaveLength(3);
});

test('démarrage refusé : « Contactez votre superviseur »', async ({ page }) => {
  await mockGateway(page, { ...agent, startRefused: 'CLEANING_SESSION_OVERDUE_PAYMENT' });
  await page.goto(`/agent/seance?id=${SESSION_ID}`);
  await page.getByRole('button', { name: 'Je suis arrivé' }).click();
  await page.locator('#photo-before-principale').setInputFiles(photo('avant.jpg'));
  await page.getByRole('button', { name: 'Démarrer la séance' }).click();
  await expect(
    page.getByText('La séance ne peut pas démarrer pour le moment. Contactez votre superviseur.'),
  ).toBeVisible();
});

test('hors connexion : arrivée, photo, démarrage et liste partent dans l’ordre, avec les mêmes clés', async ({
  page,
  context,
}) => {
  const gateway = await mockGateway(page, agent);
  await page.goto(`/agent/seance?id=${SESSION_ID}`);
  await expect(page.getByRole('button', { name: 'Je suis arrivé' })).toBeVisible();

  await setNetwork(context, gateway, false);
  await page.getByRole('button', { name: 'Je suis arrivé' }).click();
  await expect(page.getByText('Enregistré sur le téléphone : envoi dès le retour du réseau.')).toBeVisible();
  await page.locator('#photo-before-principale').setInputFiles(photo('avant.jpg'));
  await expect(
    page.getByRole('list', { name: 'Photos « avant »' }).getByText('En attente d’envoi'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Démarrer la séance' }).click();
  await expect(page.getByText('En cours', { exact: true })).toBeVisible();
  await page.getByText('Matériel déballé').click();
  await page.getByText('Sols balayés').click();
  await expect(page.getByText('2 / 2 points faits')).toBeVisible();

  // Tout s'affiche fait, rien n'est parti.
  await expect(page.getByRole('link', { name: /Hors connexion · 5 envois en attente/ })).toBeVisible();
  expect(gateway.field).toEqual([]);
  expect(gateway.stored).toEqual([]);
  const kept = await outboxOf(page);
  expect(kept.map((entry) => entry.type)).toEqual([
    'session.arrive',
    'session.photo',
    'session.start',
    'session.checklist',
    'session.checklist',
  ]);

  await setNetwork(context, gateway, true);
  await expect.poll(() => gateway.field.length, { timeout: 15_000 }).toBe(5);
  await expect(page.getByRole('link', { name: /envois? en attente/ })).toHaveCount(0);

  expect(gateway.field.map((call) => `${call.method} ${call.path.split('/').pop()}`)).toEqual([
    'POST arrive',
    'POST photos',
    'POST start',
    'PATCH checklist',
    'PATCH checklist',
  ]);
  expect(gateway.field.map((call) => call.key)).toEqual(kept.map((entry) => entry.key));
  // Corps figés au geste : heure réelle d'avant le retour du réseau.
  gateway.field.forEach((call, index) =>
    expect(call.body).toMatchObject({ occurredAt: kept[index]?.body.occurredAt }),
  );
  expect(gateway.field[1]?.body).toMatchObject({ kind: 'before', fileId: expect.any(String) });
  expect(gateway.stored).toHaveLength(1);
  expect(await outboxOf(page)).toEqual([]);
});

test.describe('réouverture sans réseau', () => {
  test.use({ serviceWorkers: 'allow' });

  test('l’espace agent rouvre la séance gardée et garde le geste pour plus tard', async ({
    page,
    context,
  }) => {
    const gateway = await mockGateway(page, agent);
    await page.goto('/agent');
    await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // La fiche ouverte une fois avec du réseau : gardée (page, écran, données du jour).
    await page.goto(`/agent/seance?id=${SESSION_ID}`);
    await expect(page.getByRole('button', { name: 'Je suis arrivé' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await setNetwork(context, gateway, false);
    await page.goto(`/agent/seance?id=${SESSION_ID}`);
    await expect(
      page.getByText(/Hors connexion : vous voyez ce qui est gardé sur ce téléphone/),
    ).toBeVisible();
    await expect(page.getByText(/Hors connexion : fiche gardée à \d\d:\d\d/)).toBeVisible();
    await page.getByRole('button', { name: 'Je suis arrivé' }).click();
    await expect(
      page.getByText('Enregistré sur le téléphone : envoi dès le retour du réseau.'),
    ).toBeVisible();

    await setNetwork(context, gateway, true);
    await expect
      .poll(() => gateway.field.map((call) => call.path.split('/').pop()), { timeout: 15_000 })
      .toEqual(['arrive']);
  });
});
