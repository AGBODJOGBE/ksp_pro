import { fireEvent, render, screen } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, sessionBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { NotificationBell } from './components/notification-bell';
import { NotificationCenter } from './components/notification-center';

const LIST = 'GET /api/v1/notification/notifications';
const COUNT = 'GET /api/v1/notification/notifications/unread-count';
const READ = 'POST /api/v1/notification/notifications/n-1/read';
const READ_ALL = 'POST /api/v1/notification/notifications/read-all';

const notification = (id: string, readAt: string | null) => ({
  id,
  templateCode: 'cleaning.assignment.proposed.agent',
  title: `Message ${id}`,
  body: 'Une séance vous est proposée.\nRetrouvez les détails dans votre application KSP.',
  link: null,
  createdAt: '2026-11-26T08:00:00Z',
  readAt,
});

beforeEach(async () => {
  await session.clear();
  session.set(sessionBody({ profileIncomplete: false }) as Parameters<typeof session.set>[0]);
});

afterEach(() => vi.unstubAllGlobals());

describe('notifications de l’agent', () => {
  it('liste sans lien, marquer comme lue', async () => {
    stubGateway({
      [LIST]: {
        status: 200,
        body: {
          data: [notification('n-1', null), notification('n-2', '2026-11-25T08:00:00Z')],
          nextCursor: null,
          unreadCount: 1,
        },
      },
      [READ]: {
        status: 200,
        body: { notification: notification('n-1', '2026-11-26T09:00:00Z'), unreadCount: 0 },
      },
    });
    render(<NotificationCenter />);

    expect(await screen.findByRole('heading', { name: 'Message n-1' })).toBeInTheDocument();
    expect(screen.getByText('1 non lue')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voir' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Marquer comme lue' }));
    expect(await screen.findByText('Aucune non lue')).toBeInTheDocument();
    expect(screen.queryByText('Non lue')).not.toBeInTheDocument();
  });

  it('tout marquer comme lu, filtre « Non lues »', async () => {
    const { fetchMock } = stubGateway({
      [LIST]: [
        { status: 200, body: { data: [notification('n-1', null)], nextCursor: null, unreadCount: 1 } },
        { status: 200, body: { data: [], nextCursor: null, unreadCount: 0 } },
      ],
      [READ_ALL]: { status: 200, body: { marked: 1, unreadCount: 0 } },
    });
    render(<NotificationCenter />);

    fireEvent.click(await screen.findByRole('button', { name: 'Tout marquer comme lu' }));
    expect(await screen.findByText('Toutes vos notifications sont marquées comme lues.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Non lues' }));
    expect(screen.getByRole('button', { name: 'Non lues' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('Vous avez tout lu.')).toBeInTheDocument();
    const last = new URL(String(fetchMock.mock.calls.at(-1)?.[0]));
    expect(last.searchParams.get('unread')).toBe('true');
  });

  it('lecture impossible : message et « Réessayer »', async () => {
    stubGateway({
      [LIST]: { status: 503, body: errorBody('NOTIFICATION_UNAVAILABLE', 'Service indisponible.') },
    });
    render(<NotificationCenter />);

    expect(await screen.findByText('Service indisponible.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('pastille : nombre de non lues dans le nom du lien', async () => {
    stubGateway({ [COUNT]: { status: 200, body: { unreadCount: 3 } } });
    render(<NotificationBell href="/agent/notifications" />);

    expect(
      await screen.findByRole('link', { name: 'Notifications — 3 notifications non lues' }),
    ).toHaveAttribute('href', '/agent/notifications');
  });
});
