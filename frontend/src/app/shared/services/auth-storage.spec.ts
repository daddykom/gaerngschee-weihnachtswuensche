import { clearPersistedAuthState, loadPersistedAuthState, persistAuthState } from './auth-storage';

describe('auth storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores a valid persisted client session', () => {
    const state = {
      userId: 'client-123',
      group: 'wunschbesteller' as const,
      email: 'client@example.com',
      fairgateUserExists: true,
      childrenCount: 2,
      adultsCount: 2,
      salutation: 'Hallo',
    };

    persistAuthState(state);

    expect(loadPersistedAuthState()).toEqual(state);
  });

  it('clears the persisted session on logout', () => {
    persistAuthState({
      userId: 'client-123',
      group: 'wunschbesteller',
      email: 'client@example.com',
      fairgateUserExists: null,
      childrenCount: null,
      adultsCount: null,
      salutation: null,
    });

    clearPersistedAuthState();

    expect(loadPersistedAuthState()).toEqual({});
  });

  it.each([
    'not-json',
    JSON.stringify({ userId: 'user-1', group: 'owner' }),
    JSON.stringify({ userId: 'user-1', group: 'wunschbesteller', childrenCount: '2' }),
  ])('clears invalid persisted state: %s', (raw) => {
    localStorage.setItem('gaerngschee.auth', raw);

    expect(loadPersistedAuthState()).toEqual({});
    expect(localStorage.getItem('gaerngschee.auth')).toBeNull();
  });

  it('clears legacy persisted state containing an application JWT', () => {
    localStorage.setItem(
      'gaerngschee.auth',
      JSON.stringify({
        token: 'legacy-jwt',
        userId: 'client-123',
        group: 'wunschbesteller',
        email: 'client@example.com',
        fairgateUserExists: null,
        childrenCount: null,
        adultsCount: null,
        salutation: null,
      }),
    );

    expect(loadPersistedAuthState()).toEqual({});
    expect(localStorage.getItem('gaerngschee.auth')).toBeNull();
  });

  it('returns an empty state when reading storage fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(loadPersistedAuthState()).toEqual({});
  });

  it('ignores errors while persisting state', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() =>
      persistAuthState({
        userId: 'client-123',
        group: 'wunschbesteller',
        fairgateUserExists: null,
        childrenCount: null,
        adultsCount: null,
        salutation: null,
      }),
    ).not.toThrow();
  });

  it('ignores errors while clearing state', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => clearPersistedAuthState()).not.toThrow();
  });
});
