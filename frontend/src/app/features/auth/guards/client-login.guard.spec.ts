import { TestBed } from '@angular/core/testing';
import { Route, Router, UrlTree } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../../store/auth/auth.actions';
import { clientLoginGuard } from './client-login.guard';

describe('clientLoginGuard', () => {
  const redirect = { url: '/start' };
  const router = {
    getCurrentNavigation: vi.fn(() => ({
      initialUrl: { queryParams: { token: 'registration-token' } },
    })),
    url: '/client-login',
    parseUrl: vi.fn(() => redirect),
  };
  const store = { dispatch: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: Store, useValue: store },
      ],
    });
  });

  it('allows the client-login page to render when a token is present', () => {
    const result = TestBed.runInInjectionContext(() =>
      clientLoginGuard({} as Route, [], {} as never),
    );

    expect(result).toBe(true);
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it('redirects to start and stores an error when the token is missing', () => {
    router.getCurrentNavigation.mockReturnValue({ initialUrl: { queryParams: {} } } as never);

    const result = TestBed.runInInjectionContext(() =>
      clientLoginGuard({} as Route, [], {} as never),
    );

    expect(result).toBe(redirect as unknown as UrlTree);
    expect(store.dispatch).toHaveBeenCalledWith(
      AuthActions.registrationLoginFailure({ errorCode: 'INVALID_REGISTRATION_TOKEN' }),
    );
  });
});
