import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { session } from '@/lib/api';
import {
  AGENT_PERMS,
  errorBody,
  type FakeResponse,
  sessionBody,
  stubGateway,
} from '@/lib/api/fake-gateway.test-utils';
import { DRAFT_KEY, saveDraft } from '@/features/cleaning/application/draft';
import { STEPS } from '@/features/cleaning/application/steps';
import { agentBody, completeDraft, SKILLS, ZONES } from '@/features/cleaning/cleaning.test-utils';
import { keepInvitation, readInvitation } from '@/features/cleaning/invitation';
import { ApplicationScreen } from './application-screen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

const USER_ID = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11';
const INVITATION = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e20';
const ME = 'GET /api/v1/cleaning/agent/me';
const ZONES_ROUTE = 'GET /api/v1/cleaning/catalog/zones';
const SKILLS_ROUTE = 'GET /api/v1/admin/cleaning/skills';
const SUBMIT = 'POST /api/v1/cleaning/agent/applications';
const NOT_CANDIDATE = {
  status: 404,
  body: errorBody('CLEANING_AGENT_NOT_FOUND', 'Aucun profil d’agent pour ce compte.'),
};
const FORBIDDEN = { status: 403, body: errorBody('GATEWAY_FORBIDDEN', 'Accès refusé.') };
const SUMMARY = STEPS.indexOf('summary');

const catalog = (skills: FakeResponse = { status: 200, body: SKILLS }) => ({
  [ZONES_ROUTE]: { status: 200, body: ZONES },
  [SKILLS_ROUTE]: skills,
});

function open(perms?: string[]) {
  session.set(sessionBody({ profileIncomplete: false, perms }) as Parameters<typeof session.set>[0]);
  return render(<ApplicationScreen />);
}

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

/** Envoi depuis le récapitulatif, une fois la liste des compétences lue (bouton actif). */
async function send(name = 'Envoyer ma candidature') {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}
const step = (name: string) => screen.findByRole('heading', { level: 2, name });

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await session.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe('candidature : formulaire', () => {
  it('parcours complet : photos déposées au service file, envoi avec une clé d’idempotence', async () => {
    let uploads = 0;
    const { calls } = stubGateway({
      [ME]: NOT_CANDIDATE,
      ...catalog(),
      'POST /api/v1/file/uploads': () => {
        uploads += 1;
        return {
          status: 200,
          body: {
            file: {
              id: `f${uploads}`,
              purpose: 'cleaning_intervention_photo',
              fileName: 'photo.jpg',
              contentType: 'image/jpeg',
              sizeBytes: 4,
              status: 'pending',
              createdAt: '2026-11-26T09:00:00Z',
              completedAt: null,
            },
            upload: {
              url: `https://stockage.test/f${uploads}`,
              method: 'PUT',
              headers: { 'Content-Type': 'image/jpeg' },
              expiresAt: '2026-11-26T09:15:00Z',
            },
          },
        };
      },
      ...Object.fromEntries(
        [1, 2, 3].flatMap((index) => [
          [`PUT /f${index}`, { status: 200, body: {} }],
          [
            `POST /api/v1/file/files/f${index}/complete`,
            {
              status: 200,
              body: {
                id: `f${index}`,
                purpose: 'cleaning_intervention_photo',
                fileName: 'photo.jpg',
                contentType: 'image/jpeg',
                sizeBytes: 4,
                status: 'available',
                createdAt: '2026-11-26T09:00:00Z',
                completedAt: '2026-11-26T09:00:01Z',
              },
            },
          ],
        ]),
      ),
      [SUBMIT]: { status: 200, body: agentBody('applicant') },
    });
    keepInvitation(INVITATION);
    open();

    // 1. Identité, reprise du profil.
    expect(await step('Votre identité')).toBeInTheDocument();
    expect(screen.getByText('Votre invitation sera jointe à la candidature.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Prénom' })).toHaveValue('Koffi');
    next();

    // 2. Photo : obligatoire, puis déposée.
    await step('Votre photo');
    next();
    expect(await screen.findByText('Ajoutez une photo de vous.')).toBeInTheDocument();
    const jpeg = (name: string) => new File(['jpeg'], name, { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Prendre ou choisir une photo'), {
      target: { files: [jpeg('moi.jpg')] },
    });
    expect(await screen.findByText('Photo envoyée : moi.jpg')).toBeInTheDocument();
    next();

    // 3. Pièce d'identité, recto et verso.
    await step('Votre pièce d’identité');
    const [front, back] = screen.getAllByLabelText('Prendre ou choisir une photo');
    fireEvent.change(front!, { target: { files: [jpeg('recto.jpg')] } });
    expect(await screen.findByText('Photo envoyée : recto.jpg')).toBeInTheDocument();
    fireEvent.change(back!, { target: { files: [jpeg('verso.jpg')] } });
    expect(await screen.findByText('Photo envoyée : verso.jpg')).toBeInTheDocument();
    next();

    // 4. Commune, 5. zones (liste des communes desservies).
    await step('Votre commune de résidence');
    fireEvent.change(await screen.findByRole('combobox', { name: /Commune/ }), {
      target: { value: 'cotonou' },
    });
    next();
    await step('Où voulez-vous travailler ?');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cotonou' }));
    expect(screen.getByText('1 commune choisie')).toBeInTheDocument();
    next();

    // 6. Compétences actives seulement.
    await step('Vos compétences');
    expect(screen.queryByRole('checkbox', { name: 'Piscine' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Nettoyage intérieur' }));
    next();

    // 7. Disponibilités : un jour coché reçoit 08:00 – 17:00.
    await step('Vos disponibilités');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lundi' }));
    next();

    // 8. Personne à prévenir, 9. statut, 10. Mobile Money facultatif.
    await step('Personne à prévenir');
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom et prénom' }), {
      target: { value: 'Afi Adjovi' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Téléphone/ }), {
      target: { value: '01 97 00 00 46' },
    });
    next();
    await step('Votre statut');
    fireEvent.click(screen.getByRole('radio', { name: /Indépendant partenaire/ }));
    next();
    await step('Numéro Mobile Money');
    next();

    // 11. Récapitulatif, puis envoi.
    await step('Vérifiez votre candidature');
    expect(screen.getAllByText('Cotonou')).toHaveLength(2);
    expect(screen.getByText('Recto et verso fournis')).toBeInTheDocument();
    expect(screen.getByText('Jointe à la candidature')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma candidature' }));

    expect(await screen.findByText('Candidature envoyée. L’équipe KSP va l’examiner.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Candidature envoyée' })).toBeInTheDocument();
    const submit = calls.find((call) => `${call.method} ${call.path}` === SUBMIT);
    expect(submit?.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(submit?.body).toEqual({
      firstName: 'Koffi',
      lastName: 'Adjovi',
      photoFileId: 'f1',
      idDocumentFrontFileId: 'f2',
      idDocumentBackFileId: 'f3',
      residenceCommuneKey: 'cotonou',
      zoneKeys: ['cotonou'],
      skillCodes: ['interior_cleaning'],
      weekly: [{ weekday: 'mon', ranges: [{ start: '08:00', end: '17:00' }] }],
      emergencyContact: { name: 'Afi Adjovi', phone: '+2290197000046' },
      employmentKind: 'independent',
      invitationId: INVITATION,
    });
    expect(calls.filter((call) => call.path === '/api/v1/file/uploads')[0]?.body).toMatchObject({
      purpose: 'cleaning_intervention_photo',
      contentType: 'image/jpeg',
    });
    // Brouillon et invitation n'ont plus lieu d'être.
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(readInvitation()).toBeNull();
  });

  it('brouillon retrouvé sur l’appareil : reprise à l’étape enregistrée', async () => {
    stubGateway({ [ME]: NOT_CANDIDATE, ...catalog() });
    saveDraft(USER_ID, { ...completeDraft(), step: STEPS.indexOf('emergency') });
    open();

    expect(await step('Personne à prévenir')).toBeInTheDocument();
    expect(
      screen.getByText('Brouillon retrouvé : vous reprenez où vous vous étiez arrêté.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nom et prénom' })).toHaveValue('Afi Adjovi');
  });

  it('compétences illisibles pour un candidat (B4) : bientôt disponible, envoi bloqué et expliqué', async () => {
    const { calls } = stubGateway({ [ME]: NOT_CANDIDATE, ...catalog(FORBIDDEN) });
    saveDraft(USER_ID, { ...completeDraft({ skillCodes: [] }), step: STEPS.indexOf('skills') });
    open();

    expect(await screen.findByRole('heading', { name: 'Choix des compétences' })).toBeInTheDocument();
    expect(screen.getByText('Ce que le back doit fournir')).toBeInTheDocument();
    next();
    await step('Vos disponibilités');
    for (let index = STEPS.indexOf('availability'); index < SUMMARY; index += 1) next();

    await step('Vérifiez votre candidature');
    expect(screen.getByText(/Envoi impossible pour l’instant/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer ma candidature' })).toBeDisabled();
    expect(calls.some((call) => call.path === '/api/v1/cleaning/agent/applications')).toBe(false);
  });

  it('invitation refusée : message, puis envoi sans invitation avec une nouvelle clé', async () => {
    const { calls } = stubGateway({
      [ME]: NOT_CANDIDATE,
      ...catalog(),
      [SUBMIT]: [
        {
          status: 400,
          body: errorBody('CLEANING_VALIDATION_FAILED', 'Cette invitation a expiré.', {
            field: 'invitationId',
            reason: 'invitation_expired',
          }),
        },
        { status: 200, body: agentBody('applicant') },
      ],
    });
    keepInvitation(INVITATION);
    saveDraft(USER_ID, { ...completeDraft(), step: SUMMARY });
    open();

    await send();
    expect(await screen.findByText(/Cette invitation a expiré\. Vous pouvez envoyer/)).toBeInTheDocument();
    expect(readInvitation()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer sans invitation' }));
    expect(await screen.findByText('Candidature envoyée. L’équipe KSP va l’examiner.')).toBeInTheDocument();
    const [first, second] = calls.filter((call) => call.path === '/api/v1/cleaning/agent/applications');
    expect(first?.body).toMatchObject({ invitationId: INVITATION });
    expect(second?.body).not.toHaveProperty('invitationId');
    expect(second?.headers['Idempotency-Key']).not.toBe(first?.headers['Idempotency-Key']);
  });

  it('déjà candidat : l’état de la candidature remplace le formulaire', async () => {
    stubGateway({
      [ME]: [NOT_CANDIDATE, { status: 200, body: agentBody('under_review') }],
      ...catalog(),
      [SUBMIT]: {
        status: 409,
        body: errorBody('CLEANING_AGENT_ALREADY_REGISTERED', 'Ce compte a déjà un profil d’agent.'),
      },
    });
    saveDraft(USER_ID, { ...completeDraft(), step: SUMMARY });
    open();

    await send();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Candidature en cours d’examen' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ce compte a déjà une candidature d’agent. Voici son état.')).toBeInTheDocument();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('commune refusée : retour à l’étape des zones, erreur sous le champ', async () => {
    stubGateway({
      [ME]: NOT_CANDIDATE,
      ...catalog(),
      [SUBMIT]: {
        status: 404,
        body: errorBody('CLEANING_ZONE_NOT_FOUND', 'Zone inconnue.', { zoneKeys: ['abomey-calavi'] }),
      },
    });
    saveDraft(USER_ID, { ...completeDraft(), step: SUMMARY });
    open();

    await send();
    expect(await step('Où voulez-vous travailler ?')).toBeInTheDocument();
    expect(
      screen.getByText('Une commune choisie n’est plus desservie par KSP. Vérifiez vos choix.'),
    ).toBeInTheDocument();
  });

  it('vérification des communes indisponible : rien n’est enregistré, nouvel essai avec la même clé', async () => {
    const { calls } = stubGateway({
      [ME]: NOT_CANDIDATE,
      ...catalog(),
      [SUBMIT]: [
        { status: 503, body: errorBody('CLEANING_GEO_UNAVAILABLE', 'Service indisponible.') },
        { status: 200, body: agentBody('applicant') },
      ],
    });
    saveDraft(USER_ID, { ...completeDraft(), step: SUMMARY });
    open();

    await send();
    expect(
      await screen.findByText(/La vérification des communes est momentanément indisponible/),
    ).toBeInTheDocument();
    await send();
    expect(await screen.findByText('Candidature envoyée. L’équipe KSP va l’examiner.')).toBeInTheDocument();
    const [first, second] = calls.filter((call) => call.path === '/api/v1/cleaning/agent/applications');
    expect(second?.headers['Idempotency-Key']).toBe(first?.headers['Idempotency-Key']);
  });
});

describe('candidature : suivi', () => {
  it('en examen : « Actualiser » relit l’état', async () => {
    const { calls } = stubGateway({
      [ME]: [
        { status: 200, body: agentBody('under_review') },
        { status: 200, body: agentBody('active') },
      ],
    });
    open();

    expect(await screen.findByText('Candidature en cours d’examen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    expect(await screen.findByText('Candidature acceptée')).toBeInTheDocument();
    expect(calls.filter((call) => call.path === '/api/v1/cleaning/agent/me')).toHaveLength(2);
    // Acceptée, jeton sans le droit d'agent : actualiser les accès.
    expect(screen.getByRole('button', { name: 'Actualiser mes accès' })).toBeInTheDocument();
  });

  it('acceptée et droits déjà dans le jeton : ouvrir l’espace agent', async () => {
    stubGateway({ [ME]: { status: 200, body: agentBody('active') } });
    open(AGENT_PERMS);

    expect(await screen.findByRole('link', { name: 'Ouvrir mon espace agent' })).toHaveAttribute(
      'href',
      '/agent',
    );
  });

  it('refusée : sans motif, comme le prévoit le contrat', async () => {
    stubGateway({ [ME]: { status: 200, body: agentBody('rejected') } });
    open();

    expect(await screen.findByText('Candidature non retenue')).toBeInTheDocument();
    expect(screen.getByText('KSP ne communique pas le motif de sa décision.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualiser' })).not.toBeInTheDocument();
  });

  it('suspendu : contacter le superviseur', async () => {
    stubGateway({ [ME]: { status: 200, body: agentBody('suspended') } });
    open();

    expect(await screen.findByText('Compte agent suspendu')).toBeInTheDocument();
    expect(screen.getByText('Contactez votre superviseur KSP.')).toBeInTheDocument();
  });

  it('lecture impossible : message et « Réessayer »', async () => {
    stubGateway({
      [ME]: [
        { status: 503, body: errorBody('CLEANING_UNAVAILABLE', 'Service momentanément indisponible.') },
        NOT_CANDIDATE,
      ],
      ...catalog(),
    });
    open();

    expect(await screen.findByText('Service momentanément indisponible.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Devenir agent KSP' })).toBeInTheDocument(),
    );
  });
});
