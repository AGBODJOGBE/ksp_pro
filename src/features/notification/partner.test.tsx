import { fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { NotificationCenter } from './components/notification-center';
import { NotificationPreferences } from './components/notification-preferences';
import { UnreadBadge } from './components/unread-badge';
import { internalLink } from './links';

const LIST = 'GET /api/v1/notification/notifications';
const COUNT = 'GET /api/v1/notification/notifications/unread-count';
const PREFERENCES = '/api/v1/notification/preferences';
const ASSIGNMENT = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8e1001';

beforeEach(async () => {
  await session.clear();
  session.set(sessionBody({ profileIncomplete: false }) as Parameters<typeof session.set>[0]);
});

afterEach(() => vi.unstubAllGlobals());

describe('lien d’une notification (fiche du partenaire, B2)', () => {
  it.each([
    [`/partenaire/dossiers/${ASSIGNMENT}`, `/partenaire/dossier?id=${ASSIGNMENT}`],
    [`https://pro.ksp.bj/partenaire/dossiers/${ASSIGNMENT}`, `/partenaire/dossier?id=${ASSIGNMENT}`],
    [`http://localhost:3050/partenaire/dossiers/${ASSIGNMENT}/`, `/partenaire/dossier?id=${ASSIGNMENT}`],
    // Lien du portail envoyé aujourd'hui par le back, autre site, adresse inconnue : aucun bouton.
    [`https://ksp.bj/mon-espace/recouvrement/partenaire/${ASSIGNMENT}`, null],
    [`https://exemple.com/partenaire/dossiers/${ASSIGNMENT}`, null],
    [`//exemple.com/partenaire/dossiers/${ASSIGNMENT}`, null],
    ['/agent', null],
    [null, null],
  ])('%s → %s', (link, expected) => {
    expect(internalLink(link, 'http://localhost:3050')).toBe(expected);
  });
});

describe('notifications du partenaire', () => {
  it('« Voir le dossier » mène à la fiche quand le lien est une adresse de l’Espace pro', async () => {
    stubGateway({
      [LIST]: {
        status: 200,
        body: {
          data: [
            {
              id: 'n-1',
              templateCode: 'recovery.partner_assigned.partner',
              title: 'Nouveau dossier confié',
              body: 'KSP vous confie le dossier REC-2026-00012.',
              link: `https://pro.ksp.bj/partenaire/dossiers/${ASSIGNMENT}`,
              createdAt: '2026-11-03T09:05:00Z',
              readAt: null,
            },
            {
              id: 'n-2',
              templateCode: 'recovery.partner_withdrawn.partner',
              title: 'Dossier retiré',
              body: 'Le dossier REC-2026-00007 ne vous est plus confié.',
              link: null,
              createdAt: '2026-11-05T11:05:00Z',
              readAt: '2026-11-05T12:00:00Z',
            },
          ],
          nextCursor: null,
          unreadCount: 1,
        },
      },
    });
    render(<NotificationCenter space="partner" />);

    expect(
      await screen.findByText('Les messages de KSP sur les dossiers qui vous sont confiés.'),
    ).toBeInTheDocument();
    const assigned = (await screen.findByRole('heading', { name: 'Nouveau dossier confié' })).closest('li')!;
    expect(within(assigned).getByRole('link', { name: 'Voir le dossier' })).toHaveAttribute(
      'href',
      `/partenaire/dossier?id=${ASSIGNMENT}`,
    );
    const withdrawn = screen.getByRole('heading', { name: 'Dossier retiré' }).closest('li')!;
    expect(within(withdrawn).queryByRole('link')).not.toBeInTheDocument();
  });

  it('pastille des non lues dans la navigation : nombre dit après le libellé', async () => {
    stubGateway({ [COUNT]: { status: 200, body: { unreadCount: 2 } } });
    render(<UnreadBadge />);
    expect(await screen.findByText(', 2 notifications non lues')).toHaveClass('sr-only');
  });
});

describe('préférences de notification', () => {
  it('lit les canaux, enregistre le changement', async () => {
    const { calls } = stubGateway({
      [`GET ${PREFERENCES}`]: { status: 200, body: { whatsapp: true, email: true, updatedAt: null } },
      [`PUT ${PREFERENCES}`]: (body) => ({
        status: 200,
        body: { ...(body as object), updatedAt: '2026-11-26T10:00:00Z' },
      }),
    });
    render(<NotificationPreferences />);

    const whatsapp = await screen.findByRole('checkbox', { name: 'WhatsApp' });
    expect(whatsapp).toBeChecked();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    fireEvent.click(whatsapp);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Vos préférences sont enregistrées.')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({ whatsapp: false, email: true });
  });

  it('lecture impossible : message et « Réessayer »', async () => {
    stubGateway({
      [`GET ${PREFERENCES}`]: {
        status: 503,
        body: errorBody('NOTIFICATION_UNAVAILABLE', 'Service indisponible.'),
      },
    });
    render(<NotificationPreferences />);
    expect(await screen.findByText(/Service indisponible\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});
