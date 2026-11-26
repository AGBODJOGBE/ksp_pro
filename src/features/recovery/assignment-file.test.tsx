import { act as run, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { session } from '@/lib/api';
import { errorBody, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { beninDate } from '@/lib/format';
import { AssignmentFileScreen } from './components/assignment-file';
import { parseXof } from './components/form-parts';
import { act, ASSIGNMENT_ID, assignmentFile, FILE, offlinePayment } from './recovery.test-utils';

/*
 * `useSearchParams` suit l'adresse du navigateur (API History), comme Next le fait pour `pushState` :
 * les formulaires s'ouvrent dans la même page, sans nouvelle lecture de la fiche.
 */
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (notify: () => void) => {
    window.addEventListener('ksp-location', notify);
    window.addEventListener('popstate', notify);
    return () => {
      window.removeEventListener('ksp-location', notify);
      window.removeEventListener('popstate', notify);
    };
  };
  return {
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
    usePathname: () => window.location.pathname,
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  };
});

const GET = `GET ${FILE}`;
const ACTS = `POST ${FILE}/acts`;
const COLLECTIONS = `POST ${FILE}/collections`;

const original = { push: window.history.pushState, replace: window.history.replaceState };

beforeEach(async () => {
  window.history.pushState = function (...args: Parameters<History['pushState']>) {
    original.push.apply(this, args);
    window.dispatchEvent(new Event('ksp-location'));
  };
  window.history.replaceState = function (...args: Parameters<History['replaceState']>) {
    original.replace.apply(this, args);
    window.dispatchEvent(new Event('ksp-location'));
  };
  original.replace.call(window.history, null, '', `/partenaire/dossier?id=${ASSIGNMENT_ID}`);
  window.scrollTo = vi.fn();
  await session.clear();
  session.set(
    sessionBody({ profileIncomplete: false, roles: ['customer', 'recovery_bailiff'] }) as Parameters<
      typeof session.set
    >[0],
  );
});

afterEach(() => {
  window.history.pushState = original.push;
  window.history.replaceState = original.replace;
  vi.unstubAllGlobals();
});

const reads = (calls: ReturnType<typeof stubGateway>['calls']) =>
  calls.filter((call) => call.method === 'GET' && call.path === FILE);

function renderFile() {
  return render(
    <StrictMode>
      <AssignmentFileScreen />
    </StrictMode>,
  );
}

describe('fiche d’un dossier confié', () => {
  it('une seule lecture par ouverture (mode strict compris), contenu, « Actualiser » explicite', async () => {
    const { calls } = stubGateway({ [GET]: { status: 200, body: assignmentFile() } });
    renderFile();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dossier REC-2026-00012' }),
    ).toBeInTheDocument();
    expect(reads(calls)).toHaveLength(1);
    expect(
      screen.getByText('Chaque ouverture de ce dossier est enregistrée au journal de KSP.'),
    ).toBeInTheDocument();

    // Montants, débiteur (appeler, écrire), créance, créancier, pièces non lisibles, historique.
    const amounts = screen.getByRole('region', { name: 'Montants' });
    expect(within(amounts).getByText(/325\s000/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Appeler Kossi Mensah/ })).toHaveAttribute(
      'href',
      'tel:+2290197001122',
    );
    expect(screen.getByRole('link', { name: /Écrire à Kossi Mensah/ })).toHaveAttribute(
      'href',
      'mailto:kossi.mensah@exemple.bj',
    );
    expect(screen.getByText('FAC-2026-0142')).toBeInTheDocument();
    expect(screen.getByText('Quincaillerie du Port', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Aucun échéancier signé.')).toBeInTheDocument();
    const documents = screen.getByRole('region', { name: 'Pièces de la mission' });
    expect(within(documents).getByText('Mandat de recouvrement signé')).toBeInTheDocument();
    expect(within(documents).queryByRole('link')).not.toBeInTheDocument();
    expect(within(documents).getByText(/documents\/\{documentId\}\/download-url/)).toBeInTheDocument();
    const history = screen.getByRole('region', { name: 'Historique des actes' });
    const items = within(history).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Signification');
    expect(items[1]).toHaveTextContent('Sommation de payer');

    // Aucune relecture d'elle-même, même au retour sur l'onglet.
    await run(async () => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(reads(calls)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await waitFor(() => expect(reads(calls)).toHaveLength(2));
    expect(await screen.findByRole('button', { name: 'Actualiser' })).toBeEnabled();
  });

  it('404 : « Ce dossier ne vous est plus confié »', async () => {
    stubGateway({
      [GET]: {
        status: 404,
        body: errorBody('RECOVERY_ASSIGNMENT_NOT_FOUND', 'Cette assignation est introuvable.'),
      },
    });
    renderFile();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ce dossier ne vous est plus confié' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour à mes dossiers' })).toHaveAttribute(
      'href',
      '/partenaire',
    );
  });

  it('403 (B1) : accès pas encore actif, « Réessayer » relit une fois', async () => {
    const { calls } = stubGateway({
      [GET]: [
        { status: 403, body: errorBody('AUTH_FORBIDDEN', "Vous n'avez pas les droits nécessaires.") },
        { status: 200, body: assignmentFile() },
      ],
    });
    renderFile();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Votre accès partenaire n’est pas encore actif' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualiser mes accès' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dossier REC-2026-00012' }),
    ).toBeInTheDocument();
    expect(reads(calls)).toHaveLength(2);
  });

  it('panne : message avec référence et « Réessayer »', async () => {
    stubGateway({
      [GET]: { status: 503, body: errorBody('RECOVERY_DEPENDENCY_UNAVAILABLE', 'Service indisponible.') },
    });
    renderFile();
    expect(await screen.findByText(/Service indisponible\. \(référence : /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});

/** Action de la fiche : barre du bas (téléphone) et en-tête (ordinateur), l'une masquée par CSS. */
async function openForm(name: string) {
  fireEvent.click((await screen.findAllByRole('button', { name }))[0]!);
  return screen.findByRole('heading', { level: 1, name });
}

describe('« Enregistrer un acte »', () => {
  it('vérification, confirmation, clé d’idempotence ; l’acte rejoint l’historique sans relire la fiche', async () => {
    const today = beninDate();
    const recorded = { ...act('0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e2003', 'seizure', today, 50_000) };
    const { calls } = stubGateway({
      [GET]: { status: 200, body: assignmentFile() },
      [ACTS]: { status: 200, body: recorded },
    });
    renderFile();
    await openForm('Enregistrer un acte');
    expect(window.location.search).toBe(`?id=${ASSIGNMENT_ID}&action=acte`);
    expect(
      screen.getByText(/Prélevé sur la provision du créancier ; KSP n’avance aucun frais/),
    ).toBeInTheDocument();

    // Champs obligatoires.
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    expect(await screen.findByText('Choisissez le type d’acte.')).toBeInTheDocument();
    expect(screen.getByText('Indiquez le coût, en francs CFA (0 sans frais).')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Type d’acte'), { target: { value: 'seizure' } });
    // L'erreur d'un champ s'efface dès qu'il est corrigé.
    expect(screen.queryByText('Choisissez le type d’acte.')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Date de l’acte'), { target: { value: today } });
    fireEvent.change(screen.getByLabelText(/Coût de l’acte/), { target: { value: '50 000' } });
    fireEvent.change(screen.getByLabelText(/Prochaine échéance/), {
      target: { value: beninDate(new Date(), -5) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    expect(
      await screen.findByText('La prochaine échéance ne peut pas précéder la date de l’acte.'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Prochaine échéance/), {
      target: { value: beninDate(new Date(), 14) },
    });
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'Saisie du véhicule.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(await screen.findByRole('heading', { name: 'Confirmer l’enregistrement' })).toBeInTheDocument();
    expect(
      screen.getByText('L’acte sera inscrit au dossier ; le créancier et le juriste KSP seront prévenus.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’acte' }));

    expect(
      await screen.findByText('Acte enregistré. Le créancier et le juriste KSP sont prévenus.'),
    ).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({
      type: 'seizure',
      actDate: today,
      cost: { amount: 50_000, currency: 'XOF' },
      note: 'Saisie du véhicule.',
      nextStepDate: beninDate(new Date(), 14),
    });
    expect(post?.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    const history = screen.getByRole('region', { name: 'Historique des actes' });
    expect(within(history).getAllByRole('listitem')[0]).toHaveTextContent('Saisie');
    expect(reads(calls)).toHaveLength(1);
  });

  it('date refusée par le back (400, `details.field`) : l’erreur revient sous le champ', async () => {
    stubGateway({
      [GET]: { status: 200, body: assignmentFile() },
      [ACTS]: {
        status: 400,
        body: errorBody('RECOVERY_VALIDATION_FAILED', 'Date de l’acte au plus aujourd’hui.', {
          field: 'actDate',
        }),
      },
    });
    renderFile();
    await openForm('Enregistrer un acte');
    fireEvent.change(screen.getByLabelText('Type d’acte'), { target: { value: 'hearing' } });
    fireEvent.change(screen.getByLabelText(/Coût de l’acte/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer l’acte' }));

    expect(await screen.findByText('Date de l’acte au plus aujourd’hui.')).toBeInTheDocument();
    expect(screen.getByLabelText('Date de l’acte')).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    [
      409,
      'RECOVERY_IDEMPOTENCY_KEY_REUSED',
      'Cette demande a déjà été envoyée avec un autre contenu. Vérifiez l’historique du dossier avant de recommencer.',
    ],
    [
      422,
      'RECOVERY_INVALID_TRANSITION',
      'Cette action n’est plus possible sur ce dossier. Actualisez le dossier pour voir son état.',
    ],
  ])('%s %s expliqué', async (status, code, text) => {
    stubGateway({
      [GET]: { status: 200, body: assignmentFile() },
      [ACTS]: { status, body: errorBody(code, 'Refus.') },
    });
    renderFile();
    await openForm('Enregistrer un acte');
    fireEvent.change(screen.getByLabelText('Type d’acte'), { target: { value: 'other' } });
    fireEvent.change(screen.getByLabelText(/Coût de l’acte/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer l’acte' }));
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('404 à l’envoi : le dossier n’est plus confié', async () => {
    stubGateway({
      [GET]: { status: 200, body: assignmentFile() },
      [ACTS]: {
        status: 404,
        body: errorBody('RECOVERY_ASSIGNMENT_NOT_FOUND', 'Cette assignation est introuvable.'),
      },
    });
    renderFile();
    await openForm('Enregistrer un acte');
    fireEvent.change(screen.getByLabelText('Type d’acte'), { target: { value: 'other' } });
    fireEvent.change(screen.getByLabelText(/Coût de l’acte/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer l’acte' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ce dossier ne vous est plus confié' }),
    ).toBeInTheDocument();
  });

  it('« Annuler » revient à la fiche sans la relire', async () => {
    const { calls } = stubGateway({ [GET]: { status: 200, body: assignmentFile() } });
    renderFile();
    await openForm('Enregistrer un acte');
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(window.location.search).toBe(`?id=${ASSIGNMENT_ID}`));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dossier REC-2026-00012' }),
    ).toBeInTheDocument();
    expect(reads(calls)).toHaveLength(1);
  });
});

describe('« Déclarer un encaissement »', () => {
  async function fillAndConfirm(amount: string) {
    await openForm('Déclarer un encaissement');
    fireEvent.change(screen.getByLabelText(/Montant reçu/), { target: { value: amount } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Déclarer l’encaissement' }));
  }

  it('au plus le reste dû, puis « en attente de validation » et rappel du virement sous 5 jours ouvrés', async () => {
    const today = beninDate();
    const { calls } = stubGateway({
      [GET]: { status: 200, body: assignmentFile() },
      [COLLECTIONS]: { status: 200, body: offlinePayment(50_000, today) },
    });
    renderFile();
    await openForm('Déclarer un encaissement');
    expect(screen.getByText(/Reste dû : 325\s000/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Montant reçu/), { target: { value: '400000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    expect(await screen.findByText(/Le montant ne peut pas dépasser le reste dû/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Montant reçu/), { target: { value: '50000' } });
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'Reçu en espèces à l’étude.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Déclarer l’encaissement' }));

    const done = await screen.findByRole('region', { name: 'Encaissement déclaré' });
    expect(within(done).getByText('En attente de validation par la finance')).toBeInTheDocument();
    expect(within(done).getByText('À virer à KSP sous 5 jours ouvrés')).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({
      amount: { amount: 50_000, currency: 'XOF' },
      receivedOn: today,
      note: 'Reçu en espèces à l’étude.',
    });
    expect(post?.headers['Idempotency-Key']).toBeTruthy();
    expect(reads(calls)).toHaveLength(1);
  });

  it('422 `RECOVERY_CASE_SUSPENDED` expliqué', async () => {
    stubGateway({
      [GET]: { status: 200, body: assignmentFile() },
      [COLLECTIONS]: { status: 422, body: errorBody('RECOVERY_CASE_SUSPENDED', 'Ce dossier est suspendu.') },
    });
    renderFile();
    await fillAndConfirm('10000');
    expect(await screen.findByText('Dossier suspendu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Déclarer l’encaissement' })).toBeDisabled();
    expect(screen.getByText(/la déclaration attend la décision du juriste KSP/)).toBeInTheDocument();
  });

  it('422 `RECOVERY_PAYMENT_AMOUNT_INVALID` : sous le montant', async () => {
    stubGateway({
      [GET]: { status: 200, body: assignmentFile() },
      [COLLECTIONS]: {
        status: 422,
        body: errorBody(
          'RECOVERY_PAYMENT_AMOUNT_INVALID',
          'Le montant doit être compris entre 1 FCFA et le montant dû.',
          {
            due: { amount: 5_000, currency: 'XOF' },
          },
        ),
      },
    });
    renderFile();
    await fillAndConfirm('10000');
    expect(
      await screen.findByText('Le montant doit être compris entre 1 FCFA et le montant dû.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Montant reçu/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('403 à l’envoi : accès pas encore actif', async () => {
    stubGateway({
      [GET]: { status: 200, body: assignmentFile() },
      [COLLECTIONS]: { status: 403, body: errorBody('AUTH_FORBIDDEN', 'Refusé.') },
    });
    renderFile();
    await fillAndConfirm('10000');
    expect(
      await screen.findByRole('heading', { name: 'Votre accès partenaire n’est pas encore actif' }),
    ).toBeInTheDocument();
  });
});

describe('montant saisi', () => {
  it.each([
    ['50 000', 50_000],
    ['50000', 50_000],
    ['0', 0],
    ['', null],
    ['12,5', Number.NaN],
    ['50.000', Number.NaN],
    ['-3', Number.NaN],
  ])('« %s » → %s', (input, value) => {
    expect(parseXof(input)).toEqual(value);
  });
});
