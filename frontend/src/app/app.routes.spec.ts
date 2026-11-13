import { appRoutes } from './app.routes';

describe('lazy feature routes', () => {
  const routes = appRoutes[0].children!;

  it.each([
    'start',
    'user/gift-receipts',
    'user/profile',
    'bestellung',
    'erfuellen',
    'password-reset-request',
    'password-reset',
    'admin',
  ])('loads the providers for %s only through its feature routes', async (path) => {
    const route = routes.find((route) => route.path === path)!;

    expect(route.providers).toBeUndefined();
    expect(route.resolve).toBeUndefined();
    expect(route.loadChildren).toBeTypeOf('function');

    const loaded = await route.loadChildren!();
    if (!Array.isArray(loaded)) {
      throw new Error('Expected standalone feature routes.');
    }

    expect(loaded[0].path).toBe('');
    expect(loaded[0].providers?.length).toBeGreaterThan(0);
  });

  it.each(['user/gift-receipts', 'user/profile', 'bestellung', 'admin'])(
    'keeps the access guard on the %s entry route',
    (path) => {
      expect(routes.find((route) => route.path === path)?.canActivate).toHaveLength(1);
    },
  );

  it('keeps order loading on the shared parent of the order and wish editors', async () => {
    const route = routes.find((route) => route.path === 'bestellung')!;
    const loaded = await route.loadChildren!();
    if (!Array.isArray(loaded)) {
      throw new Error('Expected standalone feature routes.');
    }

    expect(loaded[0].resolve?.['order']).toBeTypeOf('function');
    expect(loaded[0].children?.map((child) => child.path)).toEqual([
      '',
      'wunsch/neu',
      'wunsch/:itemId',
    ]);
    expect(loaded[0].children?.every((child) => child.resolve === undefined)).toBe(true);
  });
});
