afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('variables d’environnement', () => {
  it('valeurs locales par défaut : Espace pro sur 3050, gateway sur 3005', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_API_URL', undefined);
    const { publicEnv } = await import('./env');
    expect(publicEnv).toMatchObject({ siteUrl: 'http://localhost:3050', apiUrl: 'http://localhost:3005' });
  });

  it('retire la barre finale', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.ksp.bj/');
    const { publicEnv } = await import('./env');
    expect(publicEnv.apiUrl).toBe('https://api.ksp.bj');
  });

  it('refuse une adresse incomplète avec un message clair', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'api.ksp.bj');
    await expect(import('./env')).rejects.toThrow('NEXT_PUBLIC_API_URL : adresse complète attendue');
  });
});
