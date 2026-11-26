import { errorBody, stubGateway } from '@/lib/api/fake-gateway.test-utils';
import { uploadFile } from './api';
import { compressPhoto } from './compress';

const stored = (status: string) => ({
  id: 'f1',
  purpose: 'cleaning_intervention_photo',
  fileName: 'moi.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 4,
  status,
  rejectionReason: null,
  subject: null,
  createdAt: '2026-11-26T09:00:00Z',
  completedAt: status === 'available' ? '2026-11-26T09:00:01Z' : null,
});

const DECLARED = {
  status: 200,
  body: {
    file: stored('pending'),
    upload: {
      url: 'https://stockage.test/ksp-files/f1?X-Amz-Signature=abc',
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresAt: '2026-11-26T09:15:00Z',
    },
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('dépôt d’un fichier (service file)', () => {
  it('déclare, envoie au stockage sans jeton ni cookie, puis confirme', async () => {
    const { calls, fetchMock } = stubGateway({
      'POST /api/v1/file/uploads': DECLARED,
      'PUT /ksp-files/f1': { status: 200, body: {} },
      'POST /api/v1/file/files/f1/complete': { status: 200, body: stored('available') },
    });
    const file = new File(['jpeg'], 'moi.jpg', { type: 'image/jpeg' });

    await expect(uploadFile(file, 'cleaning_intervention_photo')).resolves.toMatchObject({
      id: 'f1',
      status: 'available',
    });
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /api/v1/file/uploads',
      'PUT /ksp-files/f1',
      'POST /api/v1/file/files/f1/complete',
    ]);
    expect(calls[0]?.body).toEqual({
      purpose: 'cleaning_intervention_photo',
      fileName: 'moi.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 4,
    });
    const storage = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(storage.credentials).toBe('omit');
    expect(storage.headers).toEqual({ 'Content-Type': 'image/jpeg' });
  });

  it('un refus de la gateway remonte avec son message', async () => {
    stubGateway({
      'POST /api/v1/file/uploads': {
        status: 422,
        body: errorBody('FILE_QUOTA_EXCEEDED', 'Trop d’envois en attente.', { limit: 'pending_uploads' }),
      },
    });
    await expect(
      uploadFile(new File(['x'], 'x.jpg', { type: 'image/jpeg' }), 'cleaning_intervention_photo'),
    ).rejects.toMatchObject({ code: 'FILE_QUOTA_EXCEEDED', message: 'Trop d’envois en attente.' });
  });

  it('sans canvas (navigateur ancien, tests), la photo d’origine est gardée', async () => {
    const file = new File(['jpeg'], 'moi.jpg', { type: 'image/jpeg' });
    await expect(compressPhoto(file)).resolves.toBe(file);
    const text = new File(['x'], 'note.txt', { type: 'text/plain' });
    await expect(compressPhoto(text)).resolves.toBe(text);
  });
});
